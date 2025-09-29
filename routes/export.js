const express = require("express");
const { Parser } = require("json2csv");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const Sale = require("../models/Sale");
const router = express.Router();

async function fetchSales({ userId, startDate, endDate } = {}) {
  const filter = {};
  if (userId) filter.soldBy = userId;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }
  return Sale.find(filter)
    .populate("product", "name price")
    .populate("soldBy", "username")
    .sort({ date: -1 });
}

// Export CSV
router.get("/sales.csv", async (req, res) => {
  try {
    const sales = await fetchSales(req.query);
    const rows = sales.map((s) => ({
      product: s.product?.name || "-",
      quantity: s.quantity,
      price: s.product?.price ?? "",
      total: s.product ? (s.quantity * s.product.price).toFixed(2) : "",
      soldBy: s.soldBy?.username || "-",
      date: new Date(s.date).toLocaleString(),
    }));
    const parser = new Parser({
      fields: ["product", "quantity", "price", "total", "soldBy", "date"],
    });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sales.csv");
    res.status(200).send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "CSV export failed" });
  }
});

// Export Excel
router.get("/sales.xlsx", async (req, res) => {
  try {
    const sales = await fetchSales(req.query);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sales");

    ws.columns = [
      { header: "Product", key: "product", width: 28 },
      { header: "Qty", key: "quantity", width: 10 },
      { header: "Price", key: "price", width: 12 },
      { header: "Total", key: "total", width: 12 },
      { header: "Sold By", key: "soldBy", width: 18 },
      { header: "Date", key: "date", width: 24 },
    ];

    sales.forEach((s) =>
      ws.addRow({
        product: s.product?.name || "-",
        quantity: s.quantity,
        price: s.product?.price ?? "",
        total: s.product ? (s.quantity * s.product.price).toFixed(2) : "",
        soldBy: s.soldBy?.username || "-",
        date: new Date(s.date).toLocaleString(),
      }),
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=sales.xlsx");

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Excel export failed" });
  }
});

// Export PDF
router.get("/sales.pdf", async (req, res) => {
  // Your existing PDF export logic from server.js
  // (Too long to include here, but move the entire function)
});

module.exports = router;