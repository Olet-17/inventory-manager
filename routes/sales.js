const express = require("express");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const User = require("../models/User");
const Notification = require("../models/Notification");
const router = express.Router();

// Get sales with filters
router.get("/", async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  const filter = {};
  if (userId) filter.soldBy = userId;
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

// Create sale
router.post("/", async (req, res) => {
  try {
    const { soldBy, productId, quantity, items } = req.body;

    if (!soldBy) return res.status(400).json({ error: "soldBy (user id) is required" });

    let lines = Array.isArray(items) ? items : [{ productId, quantity }];

    lines = lines
      .map((l) => ({
        productId: String(l.productId || "").trim(),
        quantity: parseInt(l.quantity, 10) || 0,
      }))
      .filter((l) => l.productId && l.quantity > 0);

    if (!lines.length) return res.status(400).json({ error: "No valid items to sell" });

    const merged = new Map();
    for (const l of lines) merged.set(l.productId, (merged.get(l.productId) || 0) + l.quantity);
    lines = Array.from(merged, ([pid, q]) => ({ productId: pid, quantity: q }));

    const user = await User.findById(soldBy).select("_id username role");
    if (!user) return res.status(404).json({ error: "User (soldBy) not found" });

    const ids = lines.map((l) => l.productId);
    const products = await Product.find({ _id: { $in: ids } });
    const pmap = new Map(products.map((p) => [p._id.toString(), p]));

    for (const l of lines) {
      const p = pmap.get(l.productId);
      if (!p) return res.status(404).json({ error: `Product not found (${l.productId})` });
      if (p.quantity < l.quantity)
        return res.status(400).json({
          error: `Not enough stock for ${p.name} (have ${p.quantity}, need ${l.quantity})`,
        });
    }

    const ops = lines.map((l) => ({
      updateOne: {
        filter: { _id: l.productId, quantity: { $gte: l.quantity } },
        update: { $inc: { quantity: -l.quantity } },
      },
    }));
    const result = await Product.bulkWrite(ops, { ordered: true });

    if (result.matchedCount !== lines.length || result.modifiedCount !== lines.length) {
      return res.status(409).json({ error: "Stock changed; refresh and try again." });
    }

    const salesToInsert = lines.map((l) => {
      const p = pmap.get(l.productId);
      return {
        product: p._id,
        quantity: l.quantity,
        soldBy: user._id,
        unitPrice: p.price ?? 0,
        unitCost: p.cost ?? 0,
      };
    });
    const sales = await Sale.insertMany(salesToInsert);

    const notes = [];
    for (const l of lines) {
      const p = await Product.findById(l.productId).select("name quantity");
      notes.push({
        message: `💸 ${l.quantity} x ${p.name} sold by ${user.username}`,
        type: "success",
      });
      if (typeof p.quantity === "number" && p.quantity < 5) {
        notes.push({
          message: `⚠️ Low stock: Only ${p.quantity} x ${p.name} left!`,
          type: "warning",
        });
      }
    }
    if (notes.length) await Notification.insertMany(notes);

    const populated = await Sale.find({ _id: { $in: sales.map((s) => s._id) } })
      .populate("product", "name price cost")
      .populate("soldBy", "username role");

    res.status(201).json({
      message: lines.length > 1 ? "Sale completed (multiple items)!" : "Sale completed!",
      sales: populated,
    });
  } catch (err) {
    console.error("❌ Error during sale:", err);
    res.status(500).json({ error: "Failed to complete sale" });
  }
});

// Delete sale
router.delete("/:id", async (req, res) => {
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

module.exports = router;
