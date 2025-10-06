const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

dotenv.config();

const isTest = process.env.NODE_ENV === "test";
const app = express();

// ---------- Security & core middleware ----------
app.use(
  helmet({
    contentSecurityPolicy: false, // keep off if you use inline scripts; tighten later
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors({ origin: true, credentials: true })); // allow cookies/cross-origin
app.use(express.json({ limit: "200kb" })); // sane JSON body limit
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// ---------- Database connection ----------
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/inventoryDB";

// Import SQL connection
const { sqlPool, initializeTables } = require("./db/sql");

// Import models FIRST (before routes that use them)
const Sale = require("./models/Sale");
const Product = require("./models/Product");
const User = require("./models/User");

// ---------- Sessions (Postgres store) ----------
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);

app.use(
  session({
    store: new PgStore({
      pool: sqlPool,
      tableName: "user_sessions",
      createTableIfMissing: true,
      // schemaName: "public",
    }),
    name: "sid",
    secret: process.env.SESSION_SECRET || "super-secret-session-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  }),
);

// ---------- Rate limits (apply AFTER session, BEFORE routes) ----------
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 req/min/IP
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts/15m/IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/auth-sql/login", authLimiter);
app.use("/api/auth-sql/register", authLimiter); // throttle signup too

// ---------- Routes ----------
const authRoutes = require("./routes/auth");
const authSqlRoutes = require("./routes/auth-sql");
const productRoutes = require("./routes/products");
const saleRoutes = require("./routes/sales");
const userRoutes = require("./routes/users");
const notificationRoutes = require("./routes/notifications");
const statsRoutes = require("./routes/stats");
const exportRoutes = require("./routes/export");
const uploadRoutes = require("./routes/upload");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/auth-sql", authSqlRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/upload", uploadRoutes);

// Search route
app.get("/api/search", require("./routes/search"));

// ---------- Dual Database Test Route ----------
app.get("/api/dual-test", async (req, res) => {
  try {
    // MongoDB query
    const products = await Product.find().limit(3);

    // PostgreSQL query
    const users = await sqlPool.query("SELECT * FROM users LIMIT 3");

    res.json({
      message: "Dual Database System Working!",
      mongodb: { products: products.length },
      postgresql: { users: users.rows.length },
      status: "EPIC SUCCESS! 🚀",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- Test helpers (non-production) ----------
if (process.env.NODE_ENV !== "production") {
  app.post("/api/test/reset", async (req, res) => {
    try {
      console.log("🔄 Cypress test database reset requested");

      // Clear MongoDB collections
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany();
        console.log(`🗑️ Cleared MongoDB collection: ${key}`);
      }

      // Clear PostgreSQL users table
      await sqlPool.query("TRUNCATE users RESTART IDENTITY CASCADE");
      console.log("🗑️ Cleared PostgreSQL users table");

      // Create test admin user for E2E tests
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await sqlPool.query(
        `INSERT INTO users (username, password_hash, role, email, created_at) 
         VALUES ($1, $2, $3, $4, $5)`,
        ["admin", hashedPassword, "admin", "admin@test.com", new Date()],
      );
      console.log("👤 Created test admin user");

      // Create test products in MongoDB
      await Product.create([
        { sku: "TEST-001", name: "Test Product 1", price: 29.99, cost: 15.0, quantity: 100 },
        { sku: "TEST-002", name: "Test Product 2", price: 49.99, cost: 25.0, quantity: 50 },
      ]);
      console.log("📦 Created test products");

      res.json({
        success: true,
        message: "Test database reset successfully",
        adminUser: { username: "admin", password: "admin123", role: "admin" },
      });
    } catch (error) {
      console.error("❌ Test reset error:", error);
      res.status(500).json({ success: false, error: "Database reset failed: " + error.message });
    }
  });

  app.get("/api/test/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  });
}

// ---------- Daily summary helpers ----------
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

  const lowStockCount = await Product.countDocuments({ quantity: { $lt: 5 } });

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
app.get("/api/admin/summary/preview", async (_req, res) => {
  try {
    const s = await composeDailySummary();
    res.json(s);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "preview failed" });
  }
});

app.post("/api/admin/summary/send-now", async (_req, res) => {
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
app.get("/", (_req, res) => {
  res.redirect("/html/login.html");
});

// ---------- Start server ----------
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("[DB] connected:", MONGO_URI);

    await initializeTables();
    console.log("🎯 Dual Database System: MongoDB + PostgreSQL READY!");

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
