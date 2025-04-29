const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


mongoose.connect('mongodb://127.0.0.1:27017/inventoryDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

//Skema e userit qe duhet tana per signup login 

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: 'sales' }
});
const User = mongoose.model('User', userSchema);


// Skema e produkteve qe duhet tana per CRUD
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: Number
});
const Product = mongoose.model('Product', productSchema);


// Regjistrimi I userave 
app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword, role });
  await newUser.save();
  res.json({ message: 'User registered successfully!' });
});

// Logimi i userave
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'User not found' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ id: user._id, role: user.role }, 'yourSecretKey');
  res.json({ message: 'Login successful', token });
});





// Crudet e produkteve (Edhe me shtu)
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});




// Autentifikimi i tynve
function authenticateToken(req,res,next){
  const authHeader=req.headers["authorization"];
  const token =authHeader && authHeader.split("")[1];

  if (!token) return res.status(401).json({error:"Ska token haver"})

    jwt.verify(token,"TheKey",(err,user)=>{
      if (err) return res.status(403).json({error:"Jo tokeni i duhur haver"});
      req.user=user;
      next()
    })
}

