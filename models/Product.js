const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: false, // ✅ CHANGED: Make SKU optional for now
      trim: true,
      sparse: true, // Allows multiple nulls but enforces uniqueness for non-null
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    cost: {
      type: Number,
      default: 0,
    },
    unitCost: {
      type: Number,
      default: 0,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reorderLevel: {
      type: Number,
      default: 5,
    },
    imageUrl: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// ✅ ADD: Create a unique index for SKU (but allow nulls)
productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { sku: { $type: "string" } },
  },
);

module.exports = mongoose.model("Product", productSchema);
