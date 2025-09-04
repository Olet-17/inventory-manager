// // routes/search.js
// const express = require("express");
// const router = express.Router();

// // Adjust paths to your actual models:
// const Product = require("../models/Product");
// const User    = require("../models/User");
// const Sale    = require("../models/Sale");

// // Small helper to safely build a regex from user input
// function escapeRegExp(s = "") {
//   return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// router.get("/search", async (req, res) => {
//   try {
//     const qRaw   = (req.query.q || "").trim();
//     const typesQ = (req.query.types || "products,users,sales")
//       .split(",")
//       .map(t => t.trim().toLowerCase());
//     const limit  = Math.min(parseInt(req.query.limit || "5", 10), 20); // cap at 20

//     if (qRaw.length < 2) {
//       return res.json({ results: [] });
//     }

//     const rx = new RegExp(escapeRegExp(qRaw), "i");

//     const wantProducts = typesQ.includes("products");
//     const wantUsers    = typesQ.includes("users");
//     const wantSales    = typesQ.includes("sales");

//     const tasks = [];

//     // PRODUCTS: search by name (expand fields if you have category/sku, etc.)
//     if (wantProducts) {
//       tasks.push(
//         Product.find({ name: rx })
//           .select("_id name")
//           .limit(limit)
//           .lean()
//           .then(rows =>
//             rows.map(p => ({
//               type: "Products",
//               name: p.name,
//               link: `/html/products.html?id=${p._id}`,
//             }))
//           )
//       );
//     } else {
//       tasks.push(Promise.resolve([]));
//     }

//     // USERS: search by username or email
//     if (wantUsers) {
//       tasks.push(
//         User.find({ $or: [{ username: rx }, { email: rx }] })
//           .select("_id username email role")
//           .limit(limit)
//           .lean()
//           .then(rows =>
//             rows.map(u => ({
//               type: "Users",
//               name: u.username,
//               sub: u.email || "",
//               link: `/html/manage-users.html?id=${u._id}`,
//             }))
//           )
//       );
//     } else {
//       tasks.push(Promise.resolve([]));
//     }

//     // SALES: match by product.name OR soldBy.username (via aggregation)
//     if (wantSales) {
//       tasks.push(
//         Sale.aggregate([
//           { $limit: 200 }, // soft cap before lookups; tweak for your dataset size
//           {
//             $lookup: {
//               from: "products",
//               localField: "product",
//               foreignField: "_id",
//               as: "product",
//             },
//           },
//           { $unwind: "$product" },
//           {
//             $lookup: {
//               from: "users",
//               localField: "soldBy",
//               foreignField: "_id",
//               as: "soldBy",
//             },
//           },
//           { $unwind: "$soldBy" },
//           {
//             $match: {
//               $or: [
//                 { "product.name": rx },
//                 { "soldBy.username": rx },
//                 // Optional: match formatted date strings
//                 // { date: { $gte: startOfDay, $lte: endOfDay } }
//               ],
//             },
//           },
//           {
//             $project: {
//               _id: 1,
//               quantity: 1,
//               date: 1,
//               "product.name": 1,
//               "product.price": 1,
//               "soldBy.username": 1,
//             },
//           },
//           { $limit: limit },
//         ]).then(rows =>
//           rows.map(s => ({
//             type: "Sales",
//             name: `${s.product?.name || "Sale"} × ${s.quantity ?? "?"}`,
//             sub: `by ${s.soldBy?.username || "?"} — ${new Date(s.date).toLocaleDateString()}`,
//             link: `/html/viewsalesadmin.html?id=${s._id}`,
//           }))
//         )
//       );
//     } else {
//       tasks.push(Promise.resolve([]));
//     }

//     const [productResults, userResults, saleResults] = await Promise.all(tasks);

//     // Flatten in desired order (Products, Users, Sales)
//     const results = [...productResults, ...userResults, ...saleResults];

//     res.json({ results });
//   } catch (err) {
//     console.error("Search error:", err);
//     res.status(500).json({ error: "Search failed" });
//   }
// });

// module.exports = router;
