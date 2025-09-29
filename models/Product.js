const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, index: true },
  name: String,
  price: Number,
  cost: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 5 },
  quantity: Number,
  imageUrl: { type: String, default: "" },
});

const Product = mongoose.model("Product", productSchema);

// Create indexes
Product.collection.createIndex({ name: "text" }).catch(() => {});

module.exports = Product;
