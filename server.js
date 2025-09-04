const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path=require("path")
const PDFDocument = require("pdfkit");

dotenv.config();



const app = express();
app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname, 'public')));


mongoose.connect('mongodb://127.0.0.1:27017/inventoryDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Skema e userit
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'sales' },
  lastLogin: Date,
  email: String,
  preferences: {
    theme: String,
    language: String
  }
});

const User = mongoose.model('User', userSchema);

// Skema e produkteve
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: Number
});
const Product = mongoose.model('Product', productSchema);

// Skema e shitjeve
const saleSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
  date: { type: Date, default: Date.now },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Sale = mongoose.model('Sale', saleSchema);


// Skema e notifications
const notificationSchema = new mongoose.Schema({
  message: String,
  type: { type: String, default: "info" }, // info, success, warning, error
  createdAt: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false }
});

const Notification = mongoose.model("Notification", notificationSchema);

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
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(10); // i kthen 10 më të rejat
    res.json(notifications);
  } catch (err) {
    console.error("❌ Failed to fetch notifications:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});




app.post('/api/register', async (req, res) => {
  let { username, password, role, email, preferences } = req.body;

  username = username?.trim();
  role = role?.trim();
  email = email?.trim();

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
      role,
      email,
      preferences,
      lastLogin: new Date() // ose e lë null në fillim
    });

    await newUser.save();

    if (process.env.NODE_ENV !== 'production') {
      console.log(`User registered: ${username} (${role})`);
    }

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ error: 'Failed to register user' });
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

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    // ✅ Update last login time (optional)
    user.lastLogin = new Date();
    await user.save();

    // ✅ FULL RESPONSE including user object
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email,
        preferences: user.preferences,
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Try again.' });
  }
});

// 🆕 Merr të dhënat e përdoruesit me ID
app.post('/api/me', async (req, res) => {
  const { id } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      preferences: user.preferences,
      lastLogin: user.lastLogin
    });
  } catch (err) {
    console.error('Error in /api/me:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});





// CRUD per produktet
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post('/api/products', async (req, res) => {
  const { name, price, quantity } = req.body;
  const newProduct = new Product({ name, price, quantity });
  await newProduct.save();
  res.json({ message: 'Product added successfully!' });
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, price, quantity } = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, quantity },
      { new: true }
    );
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.get('/api/sales', async (req, res) => {
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
      .populate('product', 'name price')
      .populate('soldBy', 'username role')
      .sort({ date: -1 });

    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch filtered sales' });
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
            $lte: new Date(`${year}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          total: { $sum: "$quantity" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Formati i thjeshtuar për frontend
    const data = Array(12).fill(0);
    sales.forEach(entry => {
      data[entry._id - 1] = entry.total;
    });

    res.json({ year, sales: data }); // sales = [jan, feb, mar, ...]
  } catch (err) {
    console.error("❌ Error fetching sales by month:", err);
    res.status(500).json({ error: "Failed to get sales stats" });
  }
});



app.get("/api/stats/sales-per-user", async (req, res) => {
  try {
    const sales = await Sale.aggregate([
      {
        $group: {
          _id: "$soldBy",
          totalSales: { $sum: "$quantity" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      },
      {
        $project: {
          username: "$user.username",
          totalSales: 1
        }
      },
      {
        $sort: { totalSales: -1 }
      }
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
          totalSold: { $sum: "$quantity" }
        }
      },
      {
        $sort: { totalSold: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      {
        $unwind: "$productDetails"
      },
      {
        $project: {
          name: "$productDetails.name",
          totalSold: 1
        }
      }
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
          count: { $sum: 1 }
        }
      }
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

app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// GET all users (admin)
app.get('/api/users', async (req, res) => {
  const users = await User.find({}, "-password"); // exclude passwords
  res.json(users);
});

// Change role
app.put('/api/users/:id/role', async (req, res) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  res.json(user);
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  const deleted = await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted", user: deleted });
});

app.put("/api/user/:id", async (req, res) => {
  const { email, preferences } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { email, preferences },
      { new: true }
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
    if (!isMatch) return res.status(400).json({ error: "Incorrect current password" });

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
app.post('/api/sales', async (req, res) => {
  const { productId, quantity, soldBy } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product || product.quantity < quantity) {
      return res.status(400).json({ error: 'Not enough stock' });
    }

    product.quantity -= quantity;
    await product.save();

    const sale = new Sale({
      product: productId,
      quantity,
      soldBy
    });
    await sale.save();

    const user = await User.findById(soldBy);

    // ✅ Njoftim për shitje
    await Notification.create({
      message: `💸 ${quantity} x ${product.name} sold by ${user?.username || "Unknown"}`,
      type: "success"
    });

    // ✅ Njoftim nëse ka pak stok
    if (product.quantity < 5) {
      await Notification.create({
        message: `⚠️ Low stock: Only ${product.quantity} x ${product.name} left!`,
        type: "warning"
      });
    }

    res.json({ message: 'Sale completed!', sale });

  } catch (err) {
    console.error("❌ Error during sale:", err);
    res.status(500).json({ error: 'Failed to complete sale' });
  }
});


app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Notification not found" });
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

app.get('/api/search', async (req, res) => {
  try {
    const qRaw  = (req.query.q || "").trim();
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
        $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" }
      },
      { $unwind: "$product" },
      {
        $lookup: { from: "users", localField: "soldBy", foreignField: "_id", as: "soldBy" }
      },
      { $unwind: "$soldBy" },
      {
        $match: {
          $or: [
            { "product.name": rx },
            { "soldBy.username": rx }
          ]
        }
      },
      {
        $project: {
          _id: 1,
          quantity: 1,
          date: 1,
          "product.name": 1,
          "soldBy.username": 1
        }
      },
      { $limit: limit }
    ]);

    // Normalize to a single results array your frontend expects
    const results = [
      ...products.map(p => ({
        type: "Products",
        name: p.name,
        link: `/html/products.html?id=${p._id}`
      })),
      ...users.map(u => ({
        type: "Users",
        name: u.username,
        sub: u.email || "",
        link: `/html/manage-users.html?id=${u._id}`
      })),
      ...sales.map(s => ({
        type: "Sales",
        name: `${s.product?.name || "Sale"} × ${s.quantity ?? "?"}`,
        sub: `by ${s.soldBy?.username || "?"} — ${new Date(s.date).toLocaleDateString()}`,
        link: `/html/viewsalesadmin.html?id=${s._id}`
      }))
    ];

    res.json({ results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});




app.get('/', (req, res) => {
  res.redirect('/html/login.html');
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});




