const express = require("express");
const { Parser } = require("json2csv");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const Sale = require("../models/Sale");
const Product = require("../models/Product"); // Add Product import
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

// Helper function to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
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

// Export Sales PDF
router.get("/sales.pdf", async (req, res) => {
  try {
    const sales = await fetchSales(req.query);

    console.log(`📊 Generating PDF for ${sales.length} sales records`);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");

    // Pipe PDF to response
    doc.pipe(res);

    // === PAGE 1: SALES TRANSACTIONS ONLY ===
    console.log("📄 Creating Sales Report");

    // Header
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#2c3e50")
      .text("SALES REPORT", 50, 50, { align: "center" });

    // Date range info if provided
    const { startDate, endDate } = req.query;
    let dateRangeText = "All Time";
    if (startDate || endDate) {
      dateRangeText = `${startDate ? new Date(startDate).toLocaleDateString() : "Start"} to ${endDate ? new Date(endDate).toLocaleDateString() : "End"}`;
    }

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#7f8c8d")
      .text(`Period: ${dateRangeText} | Generated on ${new Date().toLocaleDateString()}`, 50, 80, {
        align: "center",
      });

    // Summary section
    const totalSales = sales.length;
    const totalUnits = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalRevenue = sales.reduce(
      (sum, sale) => sum + sale.quantity * (sale.product?.price || 0),
      0,
    );

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#34495e").text("SUMMARY", 50, 120);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#2c3e50")
      .text(`Total Sales: ${totalSales}`, 50, 140)
      .text(`Units Sold: ${totalUnits}`, 50, 155)
      .text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 50, 170);

    // Table header
    let yPosition = 200;

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .rect(50, yPosition, 500, 20)
      .fill("#3498db");

    doc
      .text("PRODUCT", 60, yPosition + 5)
      .text("QUANTITY", 200, yPosition + 5)
      .text("PRICE", 260, yPosition + 5)
      .text("TOTAL", 320, yPosition + 5)
      .text("SOLD BY", 380, yPosition + 5)
      .text("DATE", 450, yPosition + 5);

    yPosition += 25;

    // Sales table rows
    doc.fontSize(8).font("Helvetica").fillColor("#2c3e50");

    // Add all sales
    sales.forEach((sale, index) => {
      // Add new page if needed
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;

        // Repeat header on new page
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#ffffff")
          .rect(50, yPosition, 500, 20)
          .fill("#3498db");

        doc
          .text("PRODUCT", 60, yPosition + 5)
          .text("QUANTITY", 200, yPosition + 5)
          .text("PRICE", 260, yPosition + 5)
          .text("TOTAL", 320, yPosition + 5)
          .text("SOLD BY", 380, yPosition + 5)
          .text("DATE", 450, yPosition + 5);

        yPosition += 25;
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(50, yPosition, 500, 15).fill("#f8f9fa");
      }

      const productName = sale.product?.name || "-";
      const price = sale.product?.price || 0;
      const total = sale.quantity * price;

      doc
        .fillColor("#2c3e50")
        .text(productName, 60, yPosition + 3, { width: 130 })
        .text(sale.quantity.toString(), 200, yPosition + 3)
        .text(formatCurrency(price), 260, yPosition + 3)
        .text(formatCurrency(total), 320, yPosition + 3)
        .text(sale.soldBy?.username || "-", 380, yPosition + 3, { width: 60 })
        .text(new Date(sale.date).toLocaleDateString(), 450, yPosition + 3);

      yPosition += 18;
    });

    // Add page number
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#7f8c8d")
      .text("Page 1 of 1", 50, 800, { align: "center" });

    console.log("✅ PDF generation complete");

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("❌ Sales PDF export error:", error);
    res.status(500).json({ error: "Sales PDF export failed" });
  }
});

module.exports = router;
