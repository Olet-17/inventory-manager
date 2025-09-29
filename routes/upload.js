const express = require("express");
const multer = require("multer");
const path = require("path");
const { randomBytes } = require("crypto");
const fs = require("fs");
const Product = require("../models/Product");
const router = express.Router();

const uploadDir = path.join(__dirname, "..", "public", "uploads", "products");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = randomBytes(16).toString("hex") + ext;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Only JPEG/PNG/WEBP images are allowed"), ok);
}

const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Upload product image
router.post("/products/:id/image", uploadImage.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (product.imageUrl && product.imageUrl.startsWith("/uploads/")) {
      const rel = product.imageUrl.replace(/^\//, "");
      const oldPath = path.join(__dirname, "..", "public", rel);
      fs.unlink(oldPath, () => {});
    }

    product.imageUrl = `/uploads/products/${req.file.filename}`;
    await product.save();

    res.json({
      message: "Image uploaded",
      imageUrl: product.imageUrl,
      productId: product._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

// Delete product image
router.delete("/products/:id/image", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (!product.imageUrl) return res.json({ message: "No image to remove" });

    if (product.imageUrl.startsWith("/uploads/")) {
      const rel = product.imageUrl.replace(/^\//, "");
      const filePath = path.join(__dirname, "..", "public", rel);
      fs.unlink(filePath, () => {});
    }

    product.imageUrl = "";
    await product.save();
    res.json({ message: "Image removed" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Delete failed" });
  }
});

module.exports = router;
