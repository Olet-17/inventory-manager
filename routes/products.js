const express = require("express");
const Product = require("../models/Product");
const { parse } = require("csv-parse/sync");
const multer = require("multer");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ---------------------- Validation Schemas ---------------------- */
/* ---------------------- Validation Schemas ---------------------- */
const productSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  sku: Joi.string()
    .pattern(/^[a-zA-Z0-9-_]+$/)
    .min(2)
    .max(30)
    .optional(),
  price: Joi.number().min(0).required(),
  cost: Joi.number().min(0).default(0),
  quantity: Joi.number().integer().min(0).default(0),
  reorderLevel: Joi.number().integer().min(0).default(5),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  sku: Joi.string().alphanum().min(2).max(30).optional(),
  price: Joi.number().min(0).optional(),
  cost: Joi.number().min(0).optional(),
  quantity: Joi.number().integer().min(0).optional(),
  reorderLevel: Joi.number().integer().min(0).optional(),
});

/* ---------------------- Rate Limiters ---------------------- */
// Limit creation/deletion to 20 per 15 minutes per IP
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many product changes, please slow down." },
});

/* ---------------------- Routes ---------------------- */

// Get all products
router.get("/", async (_req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Create product
router.post("/", writeLimiter, async (req, res) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Auto-cast numeric strings
    value.price = Number(value.price ?? 0);
    value.cost = Number(value.cost ?? 0);
    value.quantity = Number(value.quantity ?? 0);
    value.reorderLevel = Number(value.reorderLevel ?? 5);

    if (value.sku) {
      const exists = await Product.findOne({ sku: value.sku });
      if (exists) return res.status(400).json({ error: "SKU already exists" });
    }

    const product = await Product.create(value);
    res.status(201).json(product);
  } catch (err) {
    console.error("[POST /products] error:", err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// Update product
router.put("/:id", writeLimiter, async (req, res) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Auto-cast numeric strings
    if (value.price !== undefined) value.price = Number(value.price);
    if (value.cost !== undefined) value.cost = Number(value.cost);
    if (value.quantity !== undefined) value.quantity = Number(value.quantity);
    if (value.reorderLevel !== undefined) value.reorderLevel = Number(value.reorderLevel);

    const updated = await Product.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "Product not found" });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /products/:id] error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete product
router.delete("/:id", writeLimiter, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("[DELETE /products/:id] error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Import products from CSV
router.post("/import", writeLimiter, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No CSV file uploaded" });

    const csvString = req.file.buffer.toString("utf8");
    const rows = parse(csvString, { columns: true, skip_empty_lines: true, trim: true });
    if (!rows.length) return res.status(400).json({ error: "CSV is empty" });

    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const { error, value } = productSchema.validate(row, { allowUnknown: true });
      if (error) continue;

      const existing = value.sku ? await Product.findOne({ sku: value.sku }) : null;
      if (existing) {
        await Product.updateOne({ _id: existing._id }, value);
        updated++;
      } else {
        await Product.create(value);
        inserted++;
      }
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error("[POST /products/import] error:", err);
    res.status(500).json({ error: "Import failed" });
  }
});

module.exports = router;
