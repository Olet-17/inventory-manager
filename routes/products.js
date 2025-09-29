const express = require("express");
const Product = require("../models/Product");
const { parse } = require("csv-parse/sync");
const multer = require("multer");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Get all products
router.get("/", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Create product - FIXED: Added SKU validation
router.post("/", async (req, res) => {
  try {
    const {
      name,
      price,
      unitPrice,
      cost,
      unitCost,
      quantity,
      sku,
      reorderLevel,
    } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!sku) return res.status(400).json({ error: "SKU is required" }); // Added SKU validation

    const finalPrice = typeof unitPrice === "number" ? unitPrice : typeof price === "number" ? price : 0;
    const finalCost = typeof unitCost === "number" ? unitCost : typeof cost === "number" ? cost : 0;

    const doc = await new Product({
      name,
      price: finalPrice,
      unitPrice: finalPrice,
      cost: finalCost,
      unitCost: finalCost,
      quantity: Number(quantity ?? 0),
      sku, // Now this will always have a value
      reorderLevel: Number(reorderLevel ?? 5),
    }).save();

    return res.status(201).json(doc);
  } catch (err) {
    console.error("[POST /api/products] failed:", err);
    
    // More specific error handling
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(", ") });
    }
    
    // Handle duplicate SKU errors
    if (err.code === 11000) {
      return res.status(400).json({ error: "SKU already exists" });
    }
    
    return res.status(500).json({ error: "Failed to add product" });
  }
});

// Update product - FIXED: Added SKU handling
router.put("/:id", async (req, res) => {
  try {
    const { name, price, quantity, sku } = req.body; // Added sku
    const updateData = { name, price, quantity };
    
    // Only include sku if provided
    if (sku !== undefined) {
      updateData.sku = sku;
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true } // Added runValidators
    );
    if (!updatedProduct) return res.status(404).json({ error: "Product not found" });
    res.json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (err) {
    console.error("[PUT /api/products/:id] failed:", err);
    
    // Handle validation errors for updates too
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(", ") });
    }
    
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete product (unchanged)
router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/products/:id] failed:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Import products from CSV (unchanged - already handles SKU properly)
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Use field name 'file'." });
    }

    const csvString = req.file.buffer.toString("utf8");
    const rows = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const required = ["sku", "name"];
    const missingHeaders = required.filter((h) => !(h in rows[0] || {}));
    if (missingHeaders.length) {
      return res.status(400).json({ error: `Missing header(s): ${missingHeaders.join(", ")}` });
    }

    const report = {
      total: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const sku = String(r.sku || "").trim();
      const name = String(r.name || "").trim();
      if (!sku || !name) {
        report.skipped++;
        report.errors.push({ row: i + 1, sku, reason: "Missing sku or name" });
        continue;
      }

      const price = Number(r.price ?? 0);
      const cost = Number(r.cost ?? 0);
      const qty = Number(r.quantity ?? 0);
      const reorderLevel = Number(r.reorderLevel ?? 5);

      try {
        const existing = await Product.findOne({ sku });
        if (existing) {
          existing.name = name;
          existing.price = isNaN(price) ? existing.price : price;
          existing.cost = isNaN(cost) ? existing.cost : cost;
          existing.quantity = isNaN(qty) ? existing.quantity : qty;
          existing.reorderLevel = isNaN(reorderLevel) ? existing.reorderLevel : reorderLevel;
          await existing.save();
          report.updated++;
        } else {
          await Product.create({
            sku,
            name,
            price: isNaN(price) ? 0 : price,
            cost: isNaN(cost) ? 0 : cost,
            quantity: isNaN(qty) ? 0 : qty,
            reorderLevel: isNaN(reorderLevel) ? 5 : reorderLevel,
          });
          report.inserted++;
        }
      } catch (err) {
        report.skipped++;
        report.errors.push({ row: i + 1, sku, reason: err.message });
      }
    }

    res.json({ ok: true, ...report });
  } catch (e) {
    console.error("[/api/products/import] failed:", e);
    res.status(500).json({ error: "Import failed" });
  }
});

module.exports = router;