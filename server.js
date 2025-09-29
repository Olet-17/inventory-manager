const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");

dotenv.config();

const isTest = process.env.NODE_ENV === "test";
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// Database connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/inventoryDB";

// Import models FIRST (before routes that use them)
const Sale = require("./models/Sale");
const Product = require("./models/Product");
const User = require("./models/User");

// Import routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const saleRoutes = require("./routes/sales");
const userRoutes = require("./routes/users");
const notificationRoutes = require("./routes/notifications");
const statsRoutes = require("./routes/stats");
const exportRoutes = require("./routes/export");
const uploadRoutes = require("./routes/upload");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/upload", uploadRoutes);

// Search route
app.get("/api/search", require("./routes/search"));

// Helper functions for daily summaries
const toMoney = (n) => Number(n || 0).toFixed(2);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function composeDailySummary() {
  const since = startOfToday();

  const sales = await Sale.find({ date: { $gte: since } })
    .populate("product", "name price")
    .populate("soldBy", "username");

  const orders = sales.length;
  const units = sales.reduce((a, s) => a + (s.quantity || 0), 0);
  const revenue = sales.reduce((a, s) => a + (s.quantity || 0) * (s.product?.price || 0), 0);

  // top product by units
  const byProduct = {};
  for (const s of sales) {
    const key = s.product?.name || "-";
    byProduct[key] = (byProduct[key] || 0) + (s.quantity || 0);
  }
  const topProductEntry = Object.entries(byProduct).sort((a, b) => b[1] - a[1])[0];
  const topProduct = topProductEntry
    ? { name: topProductEntry[0], units: topProductEntry[1] }
    : null;

  // top seller by revenue
  const bySeller = {};
  for (const s of sales) {
    const key = s.soldBy?.username || "-";
    bySeller[key] = (bySeller[key] || 0) + (s.quantity || 0) * (s.product?.price || 0);
  }
  const topSellerEntry = Object.entries(bySeller).sort((a, b) => b[1] - a[1])[0];
  const topSeller = topSellerEntry ? { user: topSellerEntry[0], revenue: topSellerEntry[1] } : null;

  const lowStockCount = await Product.countDocuments({
    quantity: { $lt: 5 }, // LOW_STOCK_THRESHOLD
  });

  return {
    orders,
    units,
    revenue,
    topProduct,
    topSeller,
    lowStockCount,
    dateStr: new Date().toLocaleString(),
  };
}

async function sendDailySummaryNow() {
  const s = await composeDailySummary();
  
  // Post to Discord if webhook exists
  if (process.env.DISCORD_WEBHOOK_URL) {
    const text =
      "**Daily Sales**\n" +
      `Revenue: $${toMoney(s.revenue)} · Orders: ${s.orders} · Units: ${s.units}\n` +
      `Low stock (< 5): ${s.lowStockCount}\n` +
      (s.topProduct ? `Top product: ${s.topProduct.name} (${s.topProduct.units})\n` : "") +
      (s.topSeller ? `Top seller: ${s.topSeller.user} ($${toMoney(s.topSeller.revenue)})\n` : "") +
      `Generated: ${s.dateStr}`;

    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
  }
  
  return s;
}

// Daily summary routes
app.get("/api/admin/summary/preview", async (req, res) => {
  try {
    const s = await composeDailySummary();
    res.json(s);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "preview failed" });
  }
});

app.post("/api/admin/summary/send-now", async (req, res) => {
  try {
    if (!process.env.DISCORD_WEBHOOK_URL) {
      return res.status(500).json({ error: "Missing DISCORD_WEBHOOK_URL in .env" });
    }

    const summary = await sendDailySummaryNow();

    res.json({ ok: true, sent: summary });
  } catch (e) {
    console.error("send-now error:", e);
    res.status(500).json({ error: "send failed", details: e.message });
  }
});

// Daily summary scheduler
const DAILY_SUMMARY_CRON = process.env.DAILY_SUMMARY_CRON || "0 18 * * *";

if (!isTest && !global.__SUMMARY_JOB_STARTED__) {
  const TIMEZONE = process.env.TZ || "UTC";

  try {
    cron.schedule(
      DAILY_SUMMARY_CRON,
      async () => {
        try {
          console.log(`[summary] Running scheduled job @ ${new Date().toLocaleString()}`);
          const result = await sendDailySummaryNow();
          console.log("[summary] Sent to Discord:", result);
        } catch (err) {
          console.error("[summary] Failed to send scheduled summary:", err);
        }
      },
      { timezone: TIMEZONE },
    );

    global.__SUMMARY_JOB_STARTED__ = true;
    console.log(`[summary] Scheduler ready. CRON="${DAILY_SUMMARY_CRON}" TZ="${TIMEZONE}"`);
  } catch (e) {
    console.error("[summary] Failed to start scheduler:", e);
  }
}

// Root route
app.get("/", (req, res) => {
  res.redirect("/html/login.html");
});

// Start server
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("[DB] connected:", MONGO_URI);

    if (!isTest) {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (err) {
    console.error("[DB] connection error:", err);
    process.exit(1);
  }
}

if (!isTest) start();

module.exports = app;