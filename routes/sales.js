const express = require("express");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const router = express.Router();

// Get sales with optional filtering
router.get("/", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const filter = {};

    if (userId) filter.soldBy = userId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // ✅ FIXED: Remove user population for now
    const sales = await Sale.find(filter)
      .populate("product", "name price") // Keep product data
      .sort({ date: -1 });

    res.json(sales);
  } catch (error) {
    console.error("Sales fetch error:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// Create sale
router.post("/", async (req, res) => {
  try {
    const { items, soldBy } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item required" });
    }

    const sales = [];
    const errors = [];

    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity < 1) {
        errors.push(`Invalid item: ${JSON.stringify(item)}`);
        continue;
      }

      const product = await Product.findById(productId);
      if (!product) {
        errors.push(`Product ${productId} not found`);
        continue;
      }

      if (product.quantity < quantity) {
        errors.push(`Not enough stock for ${product.name}. Available: ${product.quantity}`);
        continue;
      }

      // Create sale record
      const sale = new Sale({
        product: productId,
        quantity,
        soldBy, // Store the userId as string (no longer ObjectId reference)
        date: new Date(),
      });

      await sale.save();
      sales.push(sale);

      // Update product stock
      product.quantity -= quantity;
      await product.save();
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Some items failed",
        details: errors,
        successfulSales: sales.length,
      });
    }

    res.status(201).json({
      message: "Sale completed successfully",
      sales: sales,
    });
  } catch (error) {
    console.error("Sale creation error:", error);
    res.status(500).json({ error: "Sale creation failed" });
  }
});

module.exports = router;
