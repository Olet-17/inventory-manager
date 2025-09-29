const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  quantity: Number,
  date: { type: Date, default: Date.now },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  unitPrice: Number,
  unitCost: Number,
});

const Sale = mongoose.model("Sale", saleSchema);
module.exports = Sale;
