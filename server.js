const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const PDFDocument = require("pdfkit");
// const app = require("./app");

dotenv.config();
const isTest = process.env.NODE_ENV === "test";

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

if (!isTest) {
  mongoose
    .connect("mongodb://127.0.0.1:27017/inventoryDB")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));
}

// Skema e userit
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "sales" },
  lastLogin: Date,
  email: String,
  preferences: {
    theme: String,
    language: String,
  },
});

const User = mongoose.model("User", userSchema);

// Skema e produkteve
const productSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, index: true },
  name: String,
  price: Number,
  cost: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 5 },
  quantity: Number,
});
const Product = mongoose.model("Product", productSchema);

// Skema e shitjeve
const saleSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  quantity: Number,
  date: { type: Date, default: Date.now },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  unitPrice: Number,
  unitCost: Number,
});
const Sale = mongoose.model("Sale", saleSchema);

// Skema e notifications
const notificationSchema = new mongoose.Schema({
  message: String,
  type: { type: String, default: "info" }, // info, success, warning, error
  createdAt: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false },
});

const Notification = mongoose.model("Notification", notificationSchema);

async function fetchSales({ userId, startDate, endDate } = {}) {
  const filter = {};
  if (userId) filter.soldBy = userId;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }
  return Sale.find(filter)
    .populate("product", "name price")
    .populate("soldBy", "username")
    .sort({ date: -1 });
}

// --- FAST INDEXES (do this once, after models are created) ---
Product.collection.createIndex({ name: "text" }).catch(() => {});
User.collection
  .createIndex({ username: "text", email: "text" })
  .catch(() => {});

// --- Unified search ---
app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || 10, 10), 50);
    if (!q) return res.json([]);

    // Prefer text search if possible, fallback to regex (case-insensitive)
    const useText = q.split(/\s+/).length > 1; // multi-word: better for $text

    // PRODUCTS
    const productFilter = useText
      ? { $text: { $search: q } }
      : { name: { $regex: q, $options: "i" } };

    const products = await Product.find(productFilter)
      .limit(limit)
      .select("name price quantity")
      .lean();

    // USERS
    const userFilter = useText
      ? { $text: { $search: q } }
      : {
          $or: [
            { username: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        };

    const users = await User.find(userFilter)
      .limit(limit)
      .select("username email role")
      .lean();

    // SALES (match on product name or seller username)
    const sales = await Sale.find()
      .populate("product", "name price")
      .populate("soldBy", "username role")
      .lean();

    const filteredSales = sales
      .filter(
        (s) =>
          (s.product?.name && new RegExp(q, "i").test(s.product.name)) ||
          (s.soldBy?.username && new RegExp(q, "i").test(s.soldBy.username)),
      )
      .slice(0, limit);

    // normalize to one list
    const results = [
      ...products.map((p) => ({
        type: "product",
        id: String(p._id),
        title: p.name,
        subtitle: `$${Number(p.price || 0).toFixed(2)}  •  Qty: ${p.quantity}`,
        href: "/html/products.html",
      })),
      ...users.map((u) => ({
        type: "user",
        id: String(u._id),
        title: u.username,
        subtitle: `${u.email || "-"}  •  ${u.role}`,
        href: "/html/manage-users.html",
      })),
      ...filteredSales.map((s) => ({
        type: "sale",
        id: String(s._id),
        title: `${s.product?.name || "-"} × ${s.quantity}`,
        subtitle: `${s.soldBy?.username || "-"} • ${new Date(s.date).toLocaleDateString()} • $${((s.product?.price || 0) * s.quantity).toFixed(2)}`,
        href: "/html/viewsalesadmin.html",
      })),
    ].slice(0, limit);

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// Regjistrimi i userave
// app.post('/api/register', async (req, res) => {
//   const { username, password, role } = req.body;

//   if (!username || !password || !role) {
//     return res.status(400).json({ error: 'All fields are required' });
//   }

//   try {
//     const existingUser = await User.findOne({ username });
//     if (existingUser) {
//       return res.status(400).json({ error: 'Username already exists' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = new User({ username, password: hashedPassword, role });
//     await newUser.save();

//     res.json({ message: 'User registered successfully!' });
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to register user' });
//   }
// });

// app.post('/api/register', async (req, res) => {
//   let { username, password, role } = req.body;

//   // Trim input
//   username = username?.trim();
//   role = role?.trim();

//   // Optional: convert role to lowercase if needed
//   // role = role?.toLowerCase();

//   if (!username || !password || !role) {
//     return res.status(400).json({ error: 'All fields are required' });
//   }

//   try {
//     const existingUser = await User.findOne({ username });
//     if (existingUser) {
//       return res.status(400).json({ error: 'Username already exists' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = new User({ username, password: hashedPassword, role });
//     await newUser.save();

//     // Log only in development and avoid logging sensitive data
//     if (process.env.NODE_ENV !== 'production') {
//       console.log(`User registered: ${username} (${role})`);
//     }

//     res.status(201).json({ message: 'User registered successfully!' });
//   } catch (err) {
//     console.error('Error during registration:', err);
//     res.status(500).json({ error: 'Failed to register user' });
//   }
// });

app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(10); // i kthen 10 më të rejat
    res.json(notifications);
  } catch (err) {
    console.error("❌ Failed to fetch notifications:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

app.post("/api/register", async (req, res) => {
  let { username, password, role, email, preferences } = req.body;

  username = username?.trim();
  role = role?.trim();
  email = email?.trim();

  if (!username || !password || !role) {
    return res
      .status(400)
      .json({ error: "Username, password, and role are required" });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
      role,
      email,
      preferences,
      lastLogin: new Date(), // ose e lë null në fillim
    });

    await newUser.save();

    if (process.env.NODE_ENV !== "production") {
      console.log(`User registered: ${username} (${role})`);
    }

    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Logimi i userave (pa token)
// app.post('/api/login', async (req, res) => {
//   const { username, password } = req.body;

//   try {
//     const user = await User.findOne({ username });
//     if (!user) return res.status(400).json({ error: 'User not found' });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

//     res.json({ message: 'Login successful', user: { id: user._id, username: user.username, role: user.role } });
//   } catch (err) {
//     res.status(500).json({ error: 'Login failed. Try again.' });
//   }
// });

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    // ✅ Update last login time (optional)
    user.lastLogin = new Date();
    await user.save();

    // ✅ FULL RESPONSE including user object
    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email,
        preferences: user.preferences,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Try again." });
  }
});

// 🆕 Merr të dhënat e përdoruesit me ID
app.post("/api/me", async (req, res) => {
  const { id } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      preferences: user.preferences,
      lastLogin: user.lastLogin,
    });
  } catch (err) {
    console.error("Error in /api/me:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// CRUD per produktet
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post("/api/products", async (req, res) => {
  try {
    const {
      name,
      // allow both old & new field names
      price,
      unitPrice,
      cost,
      unitCost,
      quantity,
      sku,
      reorderLevel,
    } = req.body;

    if (!name) return res.status(400).json({ error: "name is required" });

    // normalize fields
    const finalPrice =
      typeof unitPrice === "number"
        ? unitPrice
        : typeof price === "number"
          ? price
          : 0;

    const finalCost =
      typeof unitCost === "number"
        ? unitCost
        : typeof cost === "number"
          ? cost
          : 0;

    const doc = await new Product({
      name,
      // keep both for compatibility if your schema has them
      price: finalPrice,
      unitPrice: finalPrice,
      cost: finalCost,
      unitCost: finalCost,
      quantity: Number(quantity ?? 0),
      sku,
      reorderLevel: Number(reorderLevel ?? 5),
    }).save();

    return res.status(201).json(doc);
  } catch (err) {
    console.error("[POST /api/products] failed:", err);
    return res.status(500).json({ error: "Failed to add product" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { name, price, quantity } = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, quantity },
      { new: true },
    );
    if (!updatedProduct)
      return res.status(404).json({ error: "Product not found" });
    res.json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (err) {
    console.error("[PUT /api/products/:id] failed:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct)
      return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/products/:id] failed:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

app.get("/api/sales", async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  const filter = {};

  if (userId) {
    filter.soldBy = userId;
  }

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  try {
    const sales = await Sale.find(filter)
      .populate("product", "name price")
      .populate("soldBy", "username role")
      .sort({ date: -1 });

    res.json(sales);
  } catch (err) {
    console.error("❌ Error fetching filtered sales:", err);
    res.status(500).json({ error: "Failed to fetch filtered sales" });
  }
});

// DELETE sale by ID
app.delete("/api/sales/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Sale.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Sale not found" });
    }

    res.json({ message: "Sale deleted successfully", deleted });
  } catch (err) {
    console.error("❌ Error deleting sale:", err);
    res.status(500).json({ error: "Failed to delete sale" });
  }
});

// GET total sales per month for a given year
app.get("/api/stats/sales-by-month", async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  try {
    const sales = await Sale.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$date" },
          total: { $sum: "$quantity" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Formati i thjeshtuar për frontend
    const data = Array(12).fill(0);
    sales.forEach((entry) => {
      data[entry._id - 1] = entry.total;
    });

    res.json({ year, sales: data }); // sales = [jan, feb, mar, ...]
  } catch (err) {
    console.error("❌ Error fetching sales by month:", err);
    res.status(500).json({ error: "Failed to get sales stats" });
  }
});

// Profit by month (optionally filtered by userId)
app.get("/api/stats/profit-by-month", async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const userId = req.query.userId;

    const match = {
      date: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    };
    if (userId) match.soldBy = new mongoose.Types.ObjectId(userId);

    // Pull sales for that year (with product pricing as fallback)
    const sales = await Sale.find(match).populate(
      "product",
      "unitPrice price unitCost",
    );

    const byMonth = Array(12).fill(0);

    for (const s of sales) {
      const m = new Date(s.date).getMonth();
      const qty = Number(s.quantity || 0);
      const price =
        typeof s.unitPrice === "number"
          ? s.unitPrice
          : (s.product?.unitPrice ?? s.product?.price ?? 0);
      const cost =
        typeof s.unitCost === "number"
          ? s.unitCost
          : (s.product?.unitCost ?? 0);

      byMonth[m] += (price - cost) * qty;
    }

    res.json({ year, profit: byMonth.map((v) => Math.round(v * 100) / 100) });
  } catch (e) {
    console.error("❌ Error fetching profit by month:", e);
    res.status(500).json({ error: "Failed to get profit stats" });
  }
});

app.get("/api/stats/sales-per-user", async (req, res) => {
  try {
    const sales = await Sale.aggregate([
      {
        $group: {
          _id: "$soldBy",
          totalSales: { $sum: "$quantity" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          username: "$user.username",
          totalSales: 1,
        },
      },
      {
        $sort: { totalSales: -1 },
      },
    ]);

    res.json(sales);
  } catch (err) {
    console.error("❌ Error in /sales-per-user:", err);
    res.status(500).json({ error: "Failed to fetch sales per user" });
  }
});

// Top 5 most sold products
app.get("/api/stats/top-products", async (req, res) => {
  try {
    const topProducts = await Sale.aggregate([
      {
        $group: {
          _id: "$product",
          totalSold: { $sum: "$quantity" },
        },
      },
      {
        $sort: { totalSold: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails",
      },
      {
        $project: {
          name: "$productDetails.name",
          totalSold: 1,
        },
      },
    ]);

    res.json(topProducts);
  } catch (err) {
    console.error("❌ Error fetching top products:", err);
    res.status(500).json({ error: "Failed to fetch top products" });
  }
});

// GET role breakdown
app.get("/api/stats/role-breakdown", async (req, res) => {
  try {
    const breakdown = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(breakdown); // [{ _id: 'admin', count: 2 }, { _id: 'sales', count: 6 }]
  } catch (err) {
    console.error("❌ Error getting role breakdown:", err);
    res.status(500).json({ error: "Failed to get role breakdown" });
  }
});

// Kodi per faturim
// app.get("/api/invoice/:saleId", async (req, res) => {
//   const { saleId } = req.params;

//   try {
//     const sale = await Sale.findById(saleId)
//       .populate("product", "name price")
//       .populate("soldBy", "username role");

//     if (!sale) return res.status(404).send("Sale not found");

//     const doc = new PDFDocument();

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `attachment; filename=invoice-${saleId}.pdf`);

//     doc.pipe(res);

//     doc.fontSize(20).text("🧾 Invoice", { align: "center" });
//     doc.moveDown();
//     doc.fontSize(12).text(`Invoice ID: ${sale._id}`);
//     doc.text(`Date: ${new Date(sale.date).toLocaleDateString()}`);
//     doc.text(`Sold by: ${sale.soldBy.username} (${sale.soldBy.role})`);
//     doc.moveDown();
//     doc.text(`Product: ${sale.product.name}`);
//     doc.text(`Quantity: ${sale.quantity}`);
//     doc.text(`Price/unit: €${sale.product.price.toFixed(2)}`);
//     doc.moveDown();

//     const total = sale.quantity * sale.product.price;
//     doc.font("Helvetica-Bold").text(`Total: €${total.toFixed(2)}`);
//     doc.font("Helvetica");
//     doc.moveDown().text("Thank you for your purchase!", { align: "center" });

//     doc.end();

//   } catch (err) {
//     console.error("❌ Error generating invoice:", err);
//     res.status(500).send("Failed to generate invoice");
//   }
// });

app.get("/api/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("❌ Error fetching user by ID:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const { Parser } = require("json2csv");

app.get("/api/export/sales.csv", async (req, res) => {
  try {
    const sales = await fetchSales(req.query);
    const rows = sales.map((s) => ({
      product: s.product?.name || "-",
      quantity: s.quantity,
      price: s.product?.price ?? "",
      total: s.product ? (s.quantity * s.product.price).toFixed(2) : "",
      soldBy: s.soldBy?.username || "-",
      date: new Date(s.date).toLocaleString(),
    }));
    const parser = new Parser({
      fields: ["product", "quantity", "price", "total", "soldBy", "date"],
    });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sales.csv");
    res.status(200).send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "CSV export failed" });
  }
});

const ExcelJS = require("exceljs");

app.get("/api/export/sales.xlsx", async (req, res) => {
  try {
    const sales = await fetchSales(req.query);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sales");

    ws.columns = [
      { header: "Product", key: "product", width: 28 },
      { header: "Qty", key: "quantity", width: 10 },
      { header: "Price", key: "price", width: 12 },
      { header: "Total", key: "total", width: 12 },
      { header: "Sold By", key: "soldBy", width: 18 },
      { header: "Date", key: "date", width: 24 },
    ];

    sales.forEach((s) =>
      ws.addRow({
        product: s.product?.name || "-",
        quantity: s.quantity,
        price: s.product?.price ?? "",
        total: s.product ? (s.quantity * s.product.price).toFixed(2) : "",
        soldBy: s.soldBy?.username || "-",
        date: new Date(s.date).toLocaleString(),
      }),
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=sales.xlsx");

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Excel export failed" });
  }
});

app.get("/api/export/sales.pdf", async (req, res) => {
  try {
    const sales = await fetchSales(req.query); // your existing function

    // ===== helpers =====
    const currency = (n) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(Number(n || 0));

    const fmtDate = (d) =>
      new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    // Pre-map rows for rendering
    const rows = sales.map((s) => {
      const price = s.product?.price ?? 0;
      const qty = s.quantity ?? 0;
      return {
        product: s.product?.name ?? "-",
        qty,
        price,
        total: price * qty,
        soldBy: s.soldBy?.username ?? "-",
        date: s.date,
      };
    });

    // Quick aggregates for summary page
    const totalRevenue = rows.reduce((a, r) => a + (r.total || 0), 0);
    const unitsSold = rows.reduce((a, r) => a + (r.qty || 0), 0);
    const ordersCount = rows.length;
    const avgOrderValue = ordersCount ? totalRevenue / ordersCount : 0;
    const sellerSet = new Set(rows.map((r) => r.soldBy).filter(Boolean));
    const activeSellers = sellerSet.size;
    const topProduct = (() => {
      const m = new Map();
      for (const r of rows)
        m.set(r.product, (m.get(r.product) || 0) + (r.qty || 0));
      let best = "-",
        bestQty = -1;
      for (const [name, q] of m)
        if (q > bestQty) {
          best = name;
          bestQty = q;
        }
      return { name: best, qty: Math.max(0, bestQty) };
    })();

    // ----- response headers -----
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sales-report.pdf"',
    );

    // ----- doc -----
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    // ----- layout tokens -----
    const startX = doc.page.margins.left; // 40
    const usableW =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableTop = 120;
    const rowHeight = 20;
    const headerBg = "#f3f4f6";
    const zebraColor = "#f9fafb";
    const gridColor = "#e5e7eb";

    // columns (widths sum ≈ usableW)
    const columns = [
      { key: "product", label: "Product", width: 190, align: "left" },
      { key: "qty", label: "Qty", width: 50, align: "right" },
      {
        key: "price",
        label: "Price",
        width: 85,
        align: "right",
        format: (v) => currency(v),
      },
      {
        key: "total",
        label: "Total",
        width: 95,
        align: "right",
        format: (v) => currency(v),
      },
      { key: "soldBy", label: "Sold By", width: 60, align: "left" },
      {
        key: "date",
        label: "Date",
        width: 85,
        align: "left",
        format: (v) => fmtDate(v),
      },
    ];
    const totalTableWidth = () => columns.reduce((acc, c) => acc + c.width, 0);

    // filters label (for header & cover pages)
    const filterBits = [];
    if (req.query.startDate)
      filterBits.push(`From: ${fmtDate(req.query.startDate)}`);
    if (req.query.endDate) filterBits.push(`To: ${fmtDate(req.query.endDate)}`);
    if (req.query.user && req.query.user !== "All")
      filterBits.push(`User: ${req.query.user}`);
    const filterLine = filterBits.join("   •   ") || "All data";

    // ===== footer & header (safe: no negative x) =====
    const drawFooter = () => {
      const bottom = doc.page.height - 40;
      const width = usableW;
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
      doc.text(`Generated ${new Date().toLocaleString()}`, startX, bottom, {
        width,
        align: "left",
      });
      doc.text(`Page ${doc.page.number}`, startX, bottom, {
        width,
        align: "right",
      });
    };

    const drawHeader = (title = "Sales Report", withFilters = true) => {
      const topY = 40;
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#111")
        .text(title, startX, topY, { width: usableW });

      doc
        .moveTo(startX, topY + 30)
        .lineTo(startX + usableW, topY + 30)
        .strokeColor(gridColor)
        .lineWidth(1)
        .stroke();

      if (withFilters && filterLine) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#6b7280")
          .text(filterLine, startX, topY + 40, { width: usableW });
      }
    };

    const drawTableHeader = (y) => {
      // header background
      doc
        .rect(startX, y, totalTableWidth(), rowHeight)
        .fill(headerBg)
        .fillColor("#111");

      // header titles
      let x = startX;
      doc.font("Helvetica-Bold").fontSize(10);
      columns.forEach((col) => {
        doc.text(col.label, x + 6, y + 6, {
          width: col.width - 12,
          align: col.align === "right" ? "right" : "left",
        });
        x += col.width;
      });

      // underline
      doc
        .moveTo(startX, y + rowHeight)
        .lineTo(startX + totalTableWidth(), y + rowHeight)
        .strokeColor(gridColor)
        .lineWidth(1)
        .stroke();

      doc.fillColor("#111");
    };

    const canFit = (y, needed = rowHeight) =>
      y + needed <= doc.page.height - 60;

    // ========== PAGE 1: COVER ==========
    // simple brand mark (optional placeholder)
    doc.roundedRect(startX, 60, 80, 40, 8).fillAndStroke("#f3f4f6", "#e5e7eb");
    doc
      .fillColor("#6b7280")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Inventory", startX + 14, 73);
    doc
      .fillColor("#6b7280")
      .font("Helvetica")
      .fontSize(10)
      .text("System", startX + 14, 87);

    // Title & meta
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#111827")
      .text("Sales Report", startX, 120, { width: usableW });
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#374151")
      .text(filterLine, { width: usableW });
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text(`Generated: ${new Date().toLocaleString()}`, { width: usableW });

    // Divider + intro
    doc
      .moveTo(startX, 190)
      .lineTo(startX + usableW, 190)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();
    doc.moveDown(1.2);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#374151")
      .text(
        "This report summarizes recent sales activity and provides a detailed line-item table for export and audit. All amounts are presented in USD.",
        { width: usableW, align: "left" },
      );

    // Cover footer
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Page 1", startX, doc.page.height - 40, {
        width: usableW,
        align: "right",
      });

    doc.addPage();

    // ========== PAGE 2: EXECUTIVE SUMMARY ==========
    const card = (x, y, title, value, sub) => {
      const cw = (usableW - 24) / 2; // 2 columns with 24px gap
      doc
        .save()
        .roundedRect(x, y, cw, 88, 10)
        .fillAndStroke("#ffffff", "#e5e7eb")
        .restore();
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#111827")
        .text(title, x + 14, y + 12, { width: cw - 28 });
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#111827")
        .text(value, x + 14, y + 36, { width: cw - 28 });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6b7280")
        .text(sub, x + 14, y + 66, { width: cw - 28 });
    };

    const left = startX;
    const right = startX + (usableW + 24) / 2;
    let sy = 80;

    card(
      left,
      sy,
      "Total Revenue",
      currency(totalRevenue),
      "All included rows",
    );
    card(right, sy, "Units Sold", String(unitsSold), "All included rows");
    sy += 104;
    card(left, sy, "Active Sellers", String(activeSellers), "Unique sellers");
    card(
      right,
      sy,
      "Avg Order Value",
      currency(avgOrderValue),
      "Revenue / orders",
    );
    sy += 104;
    card(left, sy, "Top Product", topProduct.name, `${topProduct.qty} units`);
    // You can add a sixth KPI here if you like:
    card(right, sy, "Orders", String(ordersCount), "Total orders");

    sy += 124;
    // Filters & notes
    doc
      .moveTo(startX, sy)
      .lineTo(startX + usableW, sy)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();
    sy += 14;
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111827")
      .text("Filters", startX, sy);
    sy += 18;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(filterLine, startX, sy, { width: usableW });
    sy += 28;
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111827")
      .text("Notes", startX, sy);
    sy += 18;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text(
        "Data aggregated from the Inventory System. Prices in USD. Times in server local time.",
        startX,
        sy,
        { width: usableW },
      );

    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Page 2", startX, doc.page.height - 40, {
        width: usableW,
        align: "right",
      });

    // ========== PAGE 3+: DETAILED TABLE ==========
    doc.addPage();
    drawHeader("Detailed Sales", true);
    drawFooter();

    let y = tableTop;
    drawTableHeader(y);
    y += rowHeight;

    let totalUnits = 0;
    let totalRevenueDetail = 0;

    rows.forEach((r, idx) => {
      if (!canFit(y, rowHeight)) {
        doc.addPage();
        drawHeader("Detailed Sales", true);
        drawFooter();
        y = tableTop;
        drawTableHeader(y);
        y += rowHeight;
      }

      // zebra
      if (idx % 2 === 0) {
        doc
          .rect(startX, y, totalTableWidth(), rowHeight)
          .fill(zebraColor)
          .fillColor("#111");
      }

      // grid line
      doc
        .moveTo(startX, y)
        .lineTo(startX + totalTableWidth(), y)
        .strokeColor(gridColor)
        .lineWidth(0.5)
        .stroke();

      // row content
      let x = startX;
      doc.font("Helvetica").fontSize(10).fillColor("#111");
      columns.forEach((col) => {
        const raw = r[col.key];
        const text = col.format ? col.format(raw) : (raw ?? "");
        doc.text(String(text), x + 6, y + 6, {
          width: col.width - 12,
          align: col.align === "right" ? "right" : "left",
          ellipsis: true,
        });
        x += col.width;
      });

      y += rowHeight;

      totalUnits += Number(r.qty || 0);
      totalRevenueDetail += Number(r.total || 0);
    });

    // bottom grid
    doc
      .moveTo(startX, y)
      .lineTo(startX + totalTableWidth(), y)
      .strokeColor(gridColor)
      .lineWidth(1)
      .stroke();

    // Summary block at the end of detail pages
    y += 18;
    if (!canFit(y, 60)) {
      doc.addPage();
      drawHeader("Detailed Sales", true);
      drawFooter();
      y = tableTop;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111")
      .text("Summary", startX, y);
    y += 10;
    doc.font("Helvetica").fontSize(11).fillColor("#111");
    doc.text(`Total Units: ${totalUnits}`, startX, y);
    doc.text(`Total Revenue: ${currency(totalRevenueDetail)}`, startX + 200, y);

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "PDF export failed" });
  }
});

// GET all users (admin)
app.get("/api/users", async (req, res) => {
  const users = await User.find({}, "-password"); // exclude passwords
  res.json(users);
});

// Change role
app.put("/api/users/:id/role", async (req, res) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true },
  );
  res.json(user);
});

// Delete user
app.delete("/api/users/:id", async (req, res) => {
  const deleted = await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted", user: deleted });
});

app.put("/api/user/:id", async (req, res) => {
  const { email, preferences } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { email, preferences },
      { new: true },
    );
    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error("❌ Failed to update user:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.put("/api/user/:id/password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Incorrect current password" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ Error updating password:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// Shitja e produktit pa autentifikim me token
app.post("/api/sales", async (req, res) => {
  try {
    const { productId, quantity, soldBy } = req.body;

    // 1) Validate inputs
    if (!productId || !quantity) {
      return res
        .status(400)
        .json({ error: "productId and quantity are required" });
    }
    if (!soldBy) {
      return res.status(400).json({ error: "soldBy (user id) is required" });
    }

    // 2) Load product and user
    const [product, user] = await Promise.all([
      Product.findById(productId),
      User.findById(soldBy).select("_id username role"),
    ]);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (!user) {
      return res.status(404).json({ error: "User (soldBy) not found" });
    }
    if (product.quantity < quantity) {
      return res.status(400).json({ error: "Not enough stock" });
    }

    // 3) Update stock
    product.quantity -= quantity;
    await product.save();

    // 4) Snapshot price & cost for accurate profit tracking
    const unitPrice = product.price ?? 0;
    const unitCost = product.cost ?? 0;

    // 5) Create sale (snapshotting price/cost)
    const sale = await new Sale({
      product: product._id,
      quantity,
      soldBy: user._id,
      unitPrice,
      unitCost,
    }).save();

    // 6) Notifications
    await Notification.create({
      message: `💸 ${quantity} x ${product.name} sold by ${user.username}`,
      type: "success",
    });

    if (product.quantity < 5) {
      await Notification.create({
        message: `⚠️ Low stock: Only ${product.quantity} x ${product.name} left!`,
        type: "warning",
      });
    }

    // 7) Return populated sale so UI shows seller/product info + snapshots
    const populatedSale = await Sale.findById(sale._id)
      .populate("product", "name price cost")
      .populate("soldBy", "username role");

    res.json({ message: "Sale completed!", sale: populatedSale });
  } catch (err) {
    console.error("❌ Error during sale:", err);
    res.status(500).json({ error: "Failed to complete sale" });
  }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Error deleting notification:", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ⬇️ Put this right after:
// const Product = mongoose.model('Product', productSchema);
// const User = mongoose.model('User', userSchema);
// const Sale = mongoose.model('Sale', saleSchema);

// Make name / username / email queries faster
productSchema.index({ name: 1 });
userSchema.index({ username: 1, email: 1 });

// If you frequently search sales by product name or seller username,
// consider denormalizing and indexing, otherwise we’ll use $lookup in the search route.

// ======= GLOBAL SEARCH =======
function escapeRegExp(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

app.get("/api/search", async (req, res) => {
  try {
    const qRaw = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "5", 10), 20);

    if (qRaw.length < 2) {
      return res.json({ results: [] });
    }

    const rx = new RegExp(escapeRegExp(qRaw), "i");

    // 1) Products (by name)
    const products = await Product.find({ name: rx })
      .select("_id name")
      .limit(limit)
      .lean();

    // 2) Users (by username OR email)
    const users = await User.find({ $or: [{ username: rx }, { email: rx }] })
      .select("_id username email role")
      .limit(limit)
      .lean();

    // 3) Sales (match product.name OR soldBy.username using $lookup)
    const sales = await Sale.aggregate([
      { $limit: 200 }, // soft cap before lookups; tweak for your data size
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "users",
          localField: "soldBy",
          foreignField: "_id",
          as: "soldBy",
        },
      },
      { $unwind: "$soldBy" },
      {
        $match: {
          $or: [{ "product.name": rx }, { "soldBy.username": rx }],
        },
      },
      {
        $project: {
          _id: 1,
          quantity: 1,
          date: 1,
          "product.name": 1,
          "soldBy.username": 1,
        },
      },
      { $limit: limit },
    ]);

    // Normalize to a single results array your frontend expects
    const results = [
      ...products.map((p) => ({
        type: "Products",
        name: p.name,
        link: `/html/products.html?id=${p._id}`,
      })),
      ...users.map((u) => ({
        type: "Users",
        name: u.username,
        sub: u.email || "",
        link: `/html/manage-users.html?id=${u._id}`,
      })),
      ...sales.map((s) => ({
        type: "Sales",
        name: `${s.product?.name || "Sale"} × ${s.quantity ?? "?"}`,
        sub: `by ${s.soldBy?.username || "?"} — ${new Date(s.date).toLocaleDateString()}`,
        link: `/html/viewsalesadmin.html?id=${s._id}`,
      })),
    ];

    res.json({ results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

const nodemailer = require("nodemailer");
const cron = require("node-cron");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g. smtp.mailtrap.io
  port: parseInt(process.env.SMTP_PORT || "2525", 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// helper to build CSV buffer (reuse from above)

async function buildCsvBuffer() {
  const sales = await fetchSales(); // last period or all; you can add filters
  const rows = sales.map((s) => ({
    product: s.product?.name || "-",
    quantity: s.quantity,
    price: s.product?.price ?? "",
    total: s.product ? (s.quantity * s.product.price).toFixed(2) : "",
    soldBy: s.soldBy?.username || "-",
    date: new Date(s.date).toLocaleString(),
  }));
  const csv = new Parser({
    fields: ["product", "quantity", "price", "total", "soldBy", "date"],
  }).parse(rows);
  return Buffer.from(csv, "utf-8");
}
// Runs at 08:00 every day
if (!isTest && !global.__SUMMARY_JOB_STARTED__) {
  const CRON_EXPR = process.env.SUMMARY_CRON || "0 18 * * *"; // default: 18:00 each day
  const TIMEZONE = process.env.TZ || "UTC";

  try {
    cron.schedule(
      CRON_EXPR,
      async () => {
        try {
          console.log(
            `[summary] Running scheduled job @ ${new Date().toLocaleString()}`,
          );
          const result = await sendDailySummaryNow(); // <-- your existing function
          console.log("[summary] Sent to Discord:", result);
        } catch (err) {
          console.error("[summary] Failed to send scheduled summary:", err);
        }
      },
      { timezone: TIMEZONE },
    );

    global.__SUMMARY_JOB_STARTED__ = true;
    console.log(
      `[summary] Scheduler ready. CRON="${CRON_EXPR}" TZ="${TIMEZONE}"`,
    );
  } catch (e) {
    console.error("[summary] Failed to start scheduler:", e);
  }
}

// --- 1) at top of server.js (with other requires) ---

// make sure these models are already defined above:
// const Sale = mongoose.model('Sale', saleSchema);
// const Product = mongoose.model('Product', productSchema);

// --- 2) ENV defaults ---
const DAILY_SUMMARY_CRON = process.env.DAILY_SUMMARY_CRON || "0 18 * * *"; // 18:00 daily
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5);
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

// --- 3) helpers ---
const currency = (n) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// --- 4) compose today’s summary (Mongo queries) ---
async function composeDailySummary() {
  const since = startOfToday();

  const sales = await Sale.find({ date: { $gte: since } })
    .populate("product", "name price")
    .populate("soldBy", "username");

  const orders = sales.length;
  const units = sales.reduce((a, s) => a + (s.quantity || 0), 0);
  const revenue = sales.reduce(
    (a, s) => a + (s.quantity || 0) * (s.product?.price || 0),
    0,
  );

  // top product by units
  const byProduct = {};
  for (const s of sales) {
    const key = s.product?.name || "-";
    byProduct[key] = (byProduct[key] || 0) + (s.quantity || 0);
  }
  const topProductEntry = Object.entries(byProduct).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const topProduct = topProductEntry
    ? { name: topProductEntry[0], units: topProductEntry[1] }
    : null;

  // top seller by revenue
  const bySeller = {};
  for (const s of sales) {
    const key = s.soldBy?.username || "-";
    bySeller[key] =
      (bySeller[key] || 0) + (s.quantity || 0) * (s.product?.price || 0);
  }
  const topSellerEntry = Object.entries(bySeller).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const topSeller = topSellerEntry
    ? { user: topSellerEntry[0], revenue: topSellerEntry[1] }
    : null;

  const lowStockCount = await Product.countDocuments({
    quantity: { $lt: LOW_STOCK_THRESHOLD },
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

// --- 5) posters ---
async function postToSlack(summary) {
  if (!SLACK_WEBHOOK_URL) return;

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "📊 Daily Sales", emoji: true },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Generated: ${summary.dateStr}` }],
    },
    { type: "divider" },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Revenue:*\n${currency(summary.revenue)}` },
        { type: "mrkdwn", text: `*Orders:*\n${summary.orders}` },
        { type: "mrkdwn", text: `*Units:*\n${summary.units}` },
        {
          type: "mrkdwn",
          text: `*Low stock (< ${LOW_STOCK_THRESHOLD}):*\n${summary.lowStockCount}`,
        },
      ],
    },
  ];

  if (summary.topProduct || summary.topSeller) {
    blocks.push({ type: "divider" });
    if (summary.topProduct) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top product:* ${summary.topProduct.name} (${summary.topProduct.units} units)`,
        },
      });
    }
    if (summary.topSeller) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top seller:* ${summary.topSeller.user} (${currency(summary.topSeller.revenue)})`,
        },
      });
    }
  }

  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
}

async function postToDiscord(summary) {
  if (!DISCORD_WEBHOOK_URL) return;
  const text =
    "**Daily Sales**\n" +
    `Revenue: ${currency(summary.revenue)} · Orders: ${summary.orders} · Units: ${summary.units}\n` +
    `Low stock (< ${LOW_STOCK_THRESHOLD}): ${summary.lowStockCount}\n` +
    (summary.topProduct
      ? `Top product: ${summary.topProduct.name} (${summary.topProduct.units})\n`
      : "") +
    (summary.topSeller
      ? `Top seller: ${summary.topSeller.user} (${currency(summary.topSeller.revenue)})\n`
      : "") +
    `Generated: ${summary.dateStr}`;

  await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });
}

async function sendDailySummaryNow() {
  const s = await composeDailySummary();
  await Promise.allSettled([postToSlack(s), postToDiscord(s)]);
  return s;
}

module.exports = app;

// --- 6) manual routes (for testing from Postman/browser) ---
app.get("/api/admin/summary/preview", async (req, res) => {
  try {
    const s = await composeDailySummary();
    res.json(s);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "preview failed" });
  }
});
// ---- Helper to build numbers safely
const toMoney = (n) => Number(n || 0).toFixed(2);

// Example implementation placeholder.
// You already have your own version; just keep it.
// It must return an object like:
// { orders, units, revenue, topProduct, topSeller, lowStockCount, dateStr }
// async function sendDailySummaryNow() {
//   // TODO: replace with your real aggregation
//   return {
//     orders: 0,
//     units: 0,
//     revenue: 0,
//     topProduct: null,
//     topSeller: null,
//     lowStockCount: 7,
//     dateStr: new Date().toLocaleString()
//   };
// }

app.post("/api/admin/summary/send-now", async (req, res) => {
  try {
    if (!process.env.DISCORD_WEBHOOK_URL) {
      return res
        .status(500)
        .json({ error: "Missing DISCORD_WEBHOOK_URL in .env" });
    }

    const summary = await sendDailySummaryNow();

    // Discord embed payload
    const discordMessage = {
      // Optional plain text (shows if embeds can’t render)
      content: "Daily Sales Summary",
      embeds: [
        {
          title: "📊 Daily Sales Summary",
          color: 0x00ae86, // teal-ish
          fields: [
            {
              name: "Orders",
              value: String(summary.orders ?? 0),
              inline: true,
            },
            {
              name: "Units Sold",
              value: String(summary.units ?? 0),
              inline: true,
            },
            {
              name: "Revenue",
              value: `$${toMoney(summary.revenue)}`,
              inline: true,
            },
            {
              name: "Top Product",
              value: summary.topProduct ? String(summary.topProduct) : "-",
              inline: true,
            },
            {
              name: "Top Seller",
              value: summary.topSeller ? String(summary.topSeller) : "-",
              inline: true,
            },
            {
              name: "Low Stock Items",
              value: String(summary.lowStockCount ?? 0),
              inline: true,
            },
          ],
          footer: { text: `Generated: ${summary.dateStr}` },
        },
      ],
    };

    // Node >=18 has global fetch
    const resp = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordMessage),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Discord webhook failed: ${resp.status} ${errText}`);
    }

    res.json({ ok: true, sent: summary });
  } catch (e) {
    console.error("send-now error:", e);
    res.status(500).json({ error: "send failed", details: e.message });
  }
});

// --- 7) start the cron AFTER Mongo is connected (where you log "MongoDB Connected") ---
// place this inside your .then(() => ...) after mongoose.connect(...)
if (!isTest) {
  cron.schedule(DAILY_SUMMARY_CRON, async () => {
    try {
      await sendDailySummaryNow();
      console.log("[DailySummary] sent");
    } catch (e) {
      console.error("[DailySummary] failed", e);
    }
  });
  console.log(`[DailySummary] scheduled with "${DAILY_SUMMARY_CRON}"`);
}

// -------- Daily Summary Scheduler --------

// Prevent double-scheduling with nodemon/hot reloads
if (!isTest && !global.__SUMMARY_JOB_STARTED__) {
  const CRON_EXPR = process.env.SUMMARY_CRON || "0 18 * * *"; // default: 18:00 each day
  const TIMEZONE = process.env.TZ || "UTC";

  try {
    cron.schedule(
      CRON_EXPR,
      async () => {
        try {
          console.log(
            `[summary] Running scheduled job @ ${new Date().toLocaleString()}`,
          );
          const result = await sendDailySummaryNow(); // <-- your existing function
          console.log("[summary] Sent to Discord:", result);
        } catch (err) {
          console.error("[summary] Failed to send scheduled summary:", err);
        }
      },
      { timezone: TIMEZONE },
    );

    global.__SUMMARY_JOB_STARTED__ = true;
    console.log(
      `[summary] Scheduler ready. CRON="${CRON_EXPR}" TZ="${TIMEZONE}"`,
    );
  } catch (e) {
    console.error("[summary] Failed to start scheduler:", e);
  }
}

// --- in server.js ---
const multer = require("multer");
const { parse } = require("csv-parse/sync");
// sync API for simplicity

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/products/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded. Use field name 'file'." });
    }

    // Parse CSV from buffer
    const csvString = req.file.buffer.toString("utf8");
    const rows = parse(csvString, {
      columns: true, // first row as headers
      skip_empty_lines: true,
      trim: true,
    });

    // Validate basic headers
    const required = ["sku", "name"];
    const missingHeaders = required.filter((h) => !(h in rows[0] || {}));
    if (missingHeaders.length) {
      return res
        .status(400)
        .json({ error: `Missing header(s): ${missingHeaders.join(", ")}` });
    }

    const report = {
      total: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [], // { row: i, sku, reason }
    };

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // normalize
      const sku = String(r.sku || "").trim();
      const name = String(r.name || "").trim();
      if (!sku || !name) {
        report.skipped++;
        report.errors.push({ row: i + 1, sku, reason: "Missing sku or name" });
        continue;
      }

      // numeric fields
      const price = Number(r.price ?? 0);
      const cost = Number(r.cost ?? 0);
      const qty = Number(r.quantity ?? 0);
      const reorderLevel = Number(r.reorderLevel ?? 5);

      try {
        // upsert by sku
        const existing = await Product.findOne({ sku });
        if (existing) {
          existing.name = name;
          existing.price = isNaN(price) ? existing.price : price;
          existing.cost = isNaN(cost) ? existing.cost : cost;
          existing.quantity = isNaN(qty) ? existing.quantity : qty;
          existing.reorderLevel = isNaN(reorderLevel)
            ? existing.reorderLevel
            : reorderLevel;
          await existing.save();
          report.updated++;
        } else {
          await Product.create({
            sku,
            name,
            price: isNaN(price) ? 0 : price,
            cost: isNaN(cost) ? 0 : cost,
            quantity: isNaN(qty) ? 0 : qty,
            reorderLevel: isNaN(reorderLevel) ? 5 : reorderLevel,
          });
          report.inserted++;
        }
      } catch (err) {
        report.skipped++;
        report.errors.push({ row: i + 1, sku, reason: err.message });
      }
    }

    res.json({ ok: true, ...report });
  } catch (e) {
    console.error("[/api/products/import] failed:", e);
    res.status(500).json({ error: "Import failed" });
  }
});

app.get("/", (req, res) => {
  res.redirect("/html/login.html");
});

const PORT = process.env.PORT || 5000;
if (!isTest) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// module.exports = { User, Product, Sale, Notification };
