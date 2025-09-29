const express = require("express");
const Sale = require("../models/Sale");
const User = require("../models/User");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const router = express.Router();

// Sales by month
router.get("/sales-by-month", async (req, res) => {
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

    const data = Array(12).fill(0);
    sales.forEach((entry) => {
      data[entry._id - 1] = entry.total;
    });

    res.json({ year, sales: data });
  } catch (err) {
    console.error("❌ Error fetching sales by month:", err);
    res.status(500).json({ error: "Failed to get sales stats" });
  }
});

// Profit by month
router.get("/profit-by-month", async (req, res) => {
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

    const sales = await Sale.find(match).populate("product", "unitPrice price unitCost");

    const byMonth = Array(12).fill(0);

    for (const s of sales) {
      const m = new Date(s.date).getMonth();
      const qty = Number(s.quantity || 0);
      const price =
        typeof s.unitPrice === "number"
          ? s.unitPrice
          : (s.product?.unitPrice ?? s.product?.price ?? 0);
      const cost = typeof s.unitCost === "number" ? s.unitCost : (s.product?.unitCost ?? 0);

      byMonth[m] += (price - cost) * qty;
    }

    res.json({ year, profit: byMonth.map((v) => Math.round(v * 100) / 100) });
  } catch (e) {
    console.error("❌ Error fetching profit by month:", e);
    res.status(500).json({ error: "Failed to get profit stats" });
  }
});

// Sales per user
router.get("/sales-per-user", async (req, res) => {
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

// Top products
router.get("/top-products", async (req, res) => {
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

// Role breakdown
router.get("/role-breakdown", async (req, res) => {
  try {
    const breakdown = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(breakdown);
  } catch (err) {
    console.error("❌ Error getting role breakdown:", err);
    res.status(500).json({ error: "Failed to get role breakdown" });
  }
});

module.exports = router;
