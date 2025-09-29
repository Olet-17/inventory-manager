const express = require("express");
const Product = require("../models/Product");
const User = require("../models/User");
const Sale = require("../models/Sale");
const router = express.Router();

function escapeRegExp(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || 10, 10), 50);
    if (!q) return res.json([]);

    const useText = q.split(/\s+/).length > 1;

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

    const users = await User.find(userFilter).limit(limit).select("username email role").lean();

    // SALES
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

module.exports = router;