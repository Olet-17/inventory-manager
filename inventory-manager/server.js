const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/inventoryDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: 'sales' }
});
const User = mongoose.model('User', userSchema);

// Product schema
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: Number
});
const Product = mongoose.model('Product', productSchema);

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
    res.json({ message: 'User registered successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    res.json({
      message: 'Login successful',
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Add new product
app.post('/api/products', async (req, res) => {
  const { name, price, quantity } = req.body;
  const newProduct = new Product({ name, price, quantity });
  await newProduct.save();
  res.json({ message: 'Product added successfully!' });
});

const saleSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
  date: { type: Date, default: Date.now },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Sale = mongoose.model('Sale', saleSchema);

app.post('/api/sales', async (req, res) => {
  const { productId, quantity, soldBy } = req.body;
  const product = await Product.findById(productId);

  if (!product || product.quantity < quantity) {
    return res.status(400).json({ error: 'Not enough stock' });
  }

  product.quantity -= quantity;
  await product.save();

  const sale = new Sale({ product: productId, quantity, soldBy });
  await sale.save();

  res.json({ message: 'Sale completed!', sale });
});





// Default route
app.get('/', (req, res) => {
  res.redirect('/html/login.html');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
