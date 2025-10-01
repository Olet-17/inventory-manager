// ===============================
// Analytics (Admin)
// ===============================

// Helper: month labels
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Elements (guarded lookups)
const notAdmin = document.getElementById("notAdmin");
const yearSelect = document.getElementById("yearSelect");
const userSelect = document.getElementById("userSelect");
const refreshBtn = document.getElementById("refreshBtn");

// KPI els
const kpiRevenue = document.getElementById("kpiRevenue");
const kpiUnits = document.getElementById("kpiUnits");
const kpiSellers = document.getElementById("kpiSellers");
const kpiLowStock = document.getElementById("kpiLowStock");

// Charts registry
let charts = {};
let topProductsChart;

// --- Format helpers ---
const currency = (n) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
const fmtCurrency = currency; // alias for convenience

// ===============================
// Init
// ===============================
window.addEventListener("DOMContentLoaded", async () => {
  // ✅ FIXED: Use localStorage instead of sessionStorage
  const uid = localStorage.getItem("userId");
  if (!uid) {
    window.location.href = "/html/login.html";
    return;
  }

  try {
    // ✅ CHANGED: Use PostgreSQL auth endpoint
    const userRes = await fetch("/api/auth-sql/user-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid }),
    });

    const userData = await userRes.json();

    // ✅ CHANGED: Check userData.user.role (PostgreSQL format)
    if (!userData.user || userData.user.role !== "admin") {
      return fail("❌ Access denied. Admins only.");
    }

    // Populate years (current ± 2) if control exists
    if (yearSelect) {
      const y = new Date().getFullYear();
      for (let yr = y + 1; yr >= y - 2; yr--) {
        const opt = document.createElement("option");
        opt.value = yr;
        opt.textContent = yr;
        if (yr === y) opt.selected = true;
        yearSelect.appendChild(opt);
      }
    }

    // ✅ CHANGED: Use PostgreSQL users endpoint
    if (userSelect) {
      const usersRes = await fetch("/api/auth-sql/users-sql");
      const usersData = await usersRes.json();
      const users = usersData.users; // PostgreSQL returns { users: [...] }
      
      users.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.id; // ✅ CHANGED: Use id instead of _id
        opt.textContent = u.username;
        userSelect.appendChild(opt);
      });
    }

    await refresh();
    if (refreshBtn) refreshBtn.addEventListener("click", refresh);
  } catch (error) {
    console.error("Error initializing analytics:", error);
    fail("❌ Failed to load analytics data");
  }
});

function fail(msg) {
  if (notAdmin) {
    notAdmin.textContent = msg;
    notAdmin.classList.remove("hidden");
  } else {
    alert(msg);
    window.location.href = "/html/dashboard.html";
  }
}

// ===============================
// Refresh (fetch + draw all)
// ===============================
async function refresh() {
  const year = yearSelect?.value || new Date().getFullYear();
  const userId = userSelect?.value || "";

  try {
    // 1) Revenue by month (sum of price*qty)
    const monthly = await revenueByMonth(year, userId);
    safeDraw(
      "revenueByMonth",
      "line",
      {
        labels: MONTHS,
        datasets: [
          {
            label: `Revenue ${year}`,
            data: monthly,
            tension: 0.35,
            fill: true,
            backgroundColor: "rgba(79,70,229,.20)",
            borderColor: "rgba(79,70,229,1)",
          },
        ],
      },
      {
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => fmtCurrency(v) } },
        },
      },
    );

    // 2) Sales per user (quantities)
    const spu = await (await fetch("/api/stats/sales-per-user")).json();
    const labelsU = spu.map((x) => x.username);
    const dataU = spu.map((x) => x.totalSales);
    safeDraw(
      "salesPerUser",
      "bar",
      {
        labels: labelsU,
        datasets: [{ label: "Units", data: dataU, backgroundColor: "rgba(34,197,94,.8)" }],
      },
      { scales: { y: { beginAtZero: true } } },
    );

    // 3) Top products (units/revenue, doughnut/bar – controlled by selects if present)
    await renderTopProducts();

    // 4) Low stock
    const products = await (await fetch("/api/products")).json();
    await renderLowStock(products, { topN: 10, threshold: 5, onlyBelow: true });

    // 5) Profit by month (client-side, no new API)
    const pbm = await profitByMonthClient(year, userId);
    safeDraw(
      "profitByMonth",
      "line",
      {
        labels: MONTHS,
        datasets: [
          {
            label: `Profit ${year}`,
            data: pbm,
            tension: 0.35,
            fill: true,
            backgroundColor: "rgba(34,197,94,.20)",
            borderColor: "rgba(34,197,94,1)",
          },
        ],
      },
      {
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => fmtCurrency(v) } },
        },
      },
    );

    // 6) Top products by profit (this month)
    const now = new Date();
    const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endISO = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    await topProductsByProfit(5, startISO, endISO);

    // 7) KPIs (now includes profit & margin if targets exist)
    await updateKPIs(products);
  } catch (error) {
    console.error("Error refreshing analytics:", error);
    fail("❌ Failed to refresh analytics data");
  }
}

// ===============================
// Revenue (client-side)
// ===============================
async function revenueByMonth(year, userId) {
  try {
    const qs = new URLSearchParams();
    qs.set("startDate", `${year}-01-01`);
    qs.set("endDate", `${year}-12-31`);
    if (userId) qs.set("userId", userId);
    const sales = await (await fetch(`/api/sales?${qs.toString()}`)).json();

    const monthRevenue = Array(12).fill(0);
    sales.forEach((s) => {
      const d = new Date(s.date);
      const m = d.getMonth();
      const price =
        typeof s.unitPrice === "number"
          ? s.unitPrice
          : (s.product?.unitPrice ?? s.product?.price ?? 0);
      monthRevenue[m] += (price || 0) * (s.quantity || 0);
    });
    return monthRevenue.map((v) => Math.round(v * 100) / 100);
  } catch (error) {
    console.error("Error calculating revenue by month:", error);
    return Array(12).fill(0);
  }
}

// ===============================
// Profit by month (client-side)
// ===============================
async function profitByMonthClient(year, userId) {
  try {
    const qs = new URLSearchParams();
    qs.set("startDate", `${year}-01-01`);
    qs.set("endDate", `${year}-12-31`);
    if (userId) qs.set("userId", userId);

    const sales = await (await fetch(`/api/sales?${qs.toString()}`)).json();

    const profitByMonth = Array(12).fill(0);
    sales.forEach((s) => {
      const m = new Date(s.date).getMonth();
      const qty = s.quantity || 0;
      const price =
        typeof s.unitPrice === "number"
          ? s.unitPrice
          : (s.product?.unitPrice ?? s.product?.price ?? 0);
      const cost = typeof s.unitCost === "number" ? s.unitCost : (s.product?.unitCost ?? 0);
      profitByMonth[m] += (price - cost) * qty;
    });
    return profitByMonth.map((v) => Math.round(v * 100) / 100);
  } catch (error) {
    console.error("Error calculating profit by month:", error);
    return Array(12).fill(0);
  }
}

// ===============================
// Top Products (units / revenue, doughnut / bar)
// ===============================
async function renderTopProducts() {
  try {
    const res = await fetch("/api/stats/top-products");
    const raw = await res.json();
    const withRevenue = await addRevenueIfMissing(raw);

    const metricSel = document.getElementById("topProdMetric"); // 'units' | 'revenue'
    const typeSel = document.getElementById("topProdType"); // 'doughnut' | 'bar'
    const topNSel = document.getElementById("topProdN"); // number

    const metric = metricSel?.value || "units";
    const chartType = typeSel?.value || "doughnut";
    const topN = Number(topNSel?.value || 5);

    const valueKey = metric === "revenue" ? "totalRevenue" : "totalSold";
    const valueFmt = metric === "revenue" ? (v) => currency(v) : (v) => String(v);
    const title = metric === "revenue" ? "Top Products by Revenue" : "Top Products by Units";

    const sorted = [...withRevenue].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
    const top = sorted.slice(0, topN);
    const rest = sorted.slice(topN);
    const otherSum = rest.reduce((s, r) => s + Number(r[valueKey] || 0), 0);
    if (otherSum > 0) top.push({ name: "Others", [valueKey]: otherSum });

    const labels = top.map((t) => t.name);
    const data = top.map((t) => Number(t[valueKey] || 0));

    const palette = [
      "#60a5fa",
      "#a78bfa",
      "#34d399",
      "#fda4af",
      "#fbbf24",
      "#38bdf8",
      "#f472b6",
      "#86efac",
      "#fcd34d",
      "#d4d4d8",
    ];
    const colors = labels.map((_, i) => palette[i % palette.length]);

    const canvas = document.getElementById("topProducts");
    if (!canvas) return; // not on this page
    const ctx = canvas.getContext("2d");
    if (topProductsChart) topProductsChart.destroy();

    const commonOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: "#cbd5e1" } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label || ""}: ${valueFmt(ctx.parsed)}`,
          },
        },
        title: {
          display: true,
          text: title,
          color: "#e7edf5",
          font: { weight: "bold", size: 14 },
        },
      },
    };

    if (chartType === "bar") {
      topProductsChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: metric, data, backgroundColor: colors, borderRadius: 8 }],
        },
        options: {
          ...commonOpts,
          indexAxis: "y",
          scales: {
            x: {
              grid: { color: "rgba(148,163,184,.15)" },
              ticks: {
                color: "#9aa6b2",
                callback: (v) => (metric === "revenue" ? currency(v) : v),
              },
            },
            y: { grid: { display: false }, ticks: { color: "#9aa6b2" } },
          },
        },
      });
    } else {
      topProductsChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
        },
        options: { ...commonOpts, cutout: "58%" },
      });
      const total = data.reduce((a, b) => a + b, 0);
      drawCenterText(
        ctx.canvas,
        metric === "revenue" ? currency(total) : String(total),
        metric === "revenue" ? "Total Revenue" : "Total Units",
      );
    }

    // Re-attach event listeners properly
    if (metricSel) metricSel.onchange = renderTopProducts;
    if (typeSel) typeSel.onchange = renderTopProducts;
    if (topNSel) topNSel.onchange = renderTopProducts;
  } catch (error) {
    console.error("Error rendering top products:", error);
  }
}

// If backend /top-products doesn't include totalRevenue, compute from /products
async function addRevenueIfMissing(list) {
  try {
    const hasRevenue = list.some((i) => typeof i.totalRevenue === "number");
    if (hasRevenue) return list;

    const prodRes = await fetch("/api/products");
    const products = await prodRes.json();
    const priceByName = new Map(products.map((p) => [p.name, Number(p.unitPrice ?? p.price ?? 0)]));

    return list.map((p) => ({
      ...p,
      totalRevenue: Number(p.totalSold || 0) * (priceByName.get(p.name) ?? 0),
    }));
  } catch (error) {
    console.error("Error adding revenue data:", error);
    return list;
  }
}

// Optional center text for doughnut charts
function drawCenterText(canvas, big, small) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  requestAnimationFrame(() => {
    const cx = width / 2,
      cy = height / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 16px Inter, system-ui, sans-serif";
    ctx.fillText(small, cx, cy - 4);
    ctx.fillStyle = "#e7edf5";
    ctx.font = "bold 20px Inter, system-ui, sans-serif";
    ctx.fillText(big, cx, cy + 20);
    ctx.restore();
  });
}

// ===============================
// Low Stock
// ===============================
async function renderLowStock(products, opts = {}) {
  try {
    const topN = opts.topN ?? 10;
    const threshold = opts.threshold ?? 5;
    const onlyBelow = opts.onlyBelow ?? true;

    const rows = (products || []).map((p) => ({
      name: p.name || "-",
      qty: Number(p.quantity || 0),
      reorder: Number(p.reorderLevel ?? threshold),
    }));

    const filtered = onlyBelow ? rows.filter((r) => r.qty < (r.reorder || threshold)) : rows;
    filtered.sort((a, b) => a.qty - b.qty);

    const data = filtered.slice(0, topN);
    const labels = data.map((r) => (r.name.length > 24 ? r.name.slice(0, 23) + "…" : r.name));
    const qtys = data.map((r) => r.qty);
    const colors = data.map((r) => {
      const th = r.reorder || threshold;
      if (r.qty < th) return "#ef4444"; // red
      if (r.qty <= th + 2) return "#f59e0b"; // amber
      return "#22c55e"; // green
    });

    const hasAnnotation = !!Chart?.registry?.plugins?.get?.("annotation");
    const annotations = hasAnnotation
      ? {
          annotations: {
            threshold: {
              type: "line",
              xMin: threshold,
              xMax: threshold,
              borderColor: "#94a3b8",
              borderWidth: 2,
              borderDash: [4, 4],
              label: {
                display: true,
                content: `Threshold: ${threshold}`,
                backgroundColor: "rgba(148,163,184,.12)",
                color: "#64748b",
                position: "start",
                padding: 4,
              },
            },
          },
        }
      : {};

    const canvas = document.getElementById("lowStock");
    if (!canvas) return;
    drawOrUpdate(
      "lowStock",
      "bar",
      {
        labels,
        datasets: [
          {
            label: "Qty Remaining",
            data: qtys,
            backgroundColor: colors,
            maxBarThickness: 28,
            borderRadius: 8,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => data[items[0].dataIndex].name,
              label: (ctx) => {
                const r = data[ctx.dataIndex];
                const th = r.reorder || threshold;
                const gap = Math.max(th - r.qty, 0);
                return [`Qty: ${r.qty}`, `Reorder level: ${th}`, `Gap: ${gap}`];
              },
            },
          },
          ...(hasAnnotation ? { annotation: annotations } : {}),
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,.15)" },
            ticks: { color: "#cbd5e1" },
          },
          y: { grid: { display: false }, ticks: { color: "#cbd5e1" } },
        },
      },
    );
  } catch (error) {
    console.error("Error rendering low stock:", error);
  }
}

// ===============================
// KPIs (now with profit & margin support)
// ===============================
async function updateKPIs(products) {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const sales = await (await fetch(`/api/sales?startDate=${start}&endDate=${end}`)).json();

    let revenue = 0,
      cost = 0,
      units = 0;
    const sellerSet = new Set();

    sales.forEach((s) => {
      const qty = s.quantity || 0;
      const price =
        typeof s.unitPrice === "number"
          ? s.unitPrice
          : (s.product?.unitPrice ?? s.product?.price ?? 0);
      const cst = typeof s.unitCost === "number" ? s.unitCost : (s.product?.unitCost ?? 0);
      revenue += price * qty;
      cost += cst * qty;
      units += qty;
      sellerSet.add(s.soldBy?._id || s.soldBy);
    });

    const profit = revenue - cost;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    if (kpiRevenue) kpiRevenue.textContent = fmtCurrency(revenue);
    if (kpiUnits) kpiUnits.textContent = units;
    if (kpiSellers) kpiSellers.textContent = sellerSet.size;
    if (kpiLowStock) kpiLowStock.textContent = products.filter((p) => p.quantity < 5).length;

    // Optional: add elements with these IDs to show them
    const kpiProfit = document.getElementById("kpiProfit");
    const kpiMargin = document.getElementById("kpiMargin");
    if (kpiProfit) kpiProfit.textContent = fmtCurrency(profit);
    if (kpiMargin) kpiMargin.textContent = marginPct.toFixed(1) + "%";
  } catch (error) {
    console.error("Error updating KPIs:", error);
  }
}

// ===============================
// Top Products by Profit (this month)
// ===============================
async function topProductsByProfit(limit = 5, startISO, endISO) {
  try {
    const qs = new URLSearchParams();
    if (startISO) qs.set("startDate", startISO);
    if (endISO) qs.set("endDate", endISO);

    const sales = await (await fetch(`/api/sales?${qs.toString()}`)).json();

    const profitMap = new Map(); // name -> profit
    sales.forEach((s) => {
      const qty = s.quantity || 0;
      const price =
        typeof s.unitPrice === "number"
          ? s.unitPrice
          : (s.product?.unitPrice ?? s.product?.price ?? 0);
      const cost = typeof s.unitCost === "number" ? s.unitCost : (s.product?.unitCost ?? 0);
      const name = s.product?.name ?? "(unknown)";
      profitMap.set(name, (profitMap.get(name) || 0) + (price - cost) * qty);
    });

    const top = [...profitMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    const labels = top.map(([n]) => n);
    const data = top.map(([, p]) => Math.round(p * 100) / 100);

    safeDraw(
      "topProfitProducts",
      "bar",
      {
        labels,
        datasets: [{ label: "Profit", data, backgroundColor: "#34d399", borderRadius: 8 }],
      },
      {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => fmtCurrency(ctx.raw) } },
        },
        scales: { x: { ticks: { callback: (v) => fmtCurrency(v) } } },
      },
    );
  } catch (error) {
    console.error("Error calculating top products by profit:", error);
  }
}

// ===============================
// Generic drawing helpers
// ===============================
function safeDraw(canvasId, type, data, options = {}) {
  const cv = document.getElementById(canvasId);
  if (!cv) return; // target not present in DOM
  drawOrUpdate(canvasId, type, data, options);
}

function drawOrUpdate(canvasId, type, data, options = {}) {
  const ctx = document.getElementById(canvasId)?.getContext("2d");
  if (!ctx) return;
  if (charts[canvasId]) {
    charts[canvasId].data = data;
    charts[canvasId].options = options;
    charts[canvasId].update();
  } else {
    charts[canvasId] = new Chart(ctx, { type, data, options });
  }
}

console.log("✅ PostgreSQL Analytics ready!");