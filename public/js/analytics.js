// Helper: month labels
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Elements
const notAdmin = document.getElementById("notAdmin");
const yearSelect = document.getElementById("yearSelect");
const userSelect = document.getElementById("userSelect");
const refreshBtn = document.getElementById("refreshBtn");

// KPI els
const kpiRevenue = document.getElementById("kpiRevenue");
const kpiUnits = document.getElementById("kpiUnits");
const kpiSellers = document.getElementById("kpiSellers");
const kpiLowStock = document.getElementById("kpiLowStock");

// Charts
let charts = {};
let topProductsChart;

// Init
window.addEventListener("DOMContentLoaded", async () => {
  const uid = sessionStorage.getItem("userId");
  if (!uid) return fail("❌ You must be logged in.");

  const userRes = await fetch(`/api/user/${uid}`);
  const { user } = await userRes.json();
  if (!user || user.role !== "admin") return fail("❌ Access denied. Admins only.");

  // populate years (current ± 2)
  const y = new Date().getFullYear();
  for (let yr = y + 1; yr >= y - 2; yr--) {
    const opt = document.createElement("option");
    opt.value = yr; opt.textContent = yr;
    if (yr === y) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  // populate users
  const users = await (await fetch("/api/users")).json();
  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u._id; opt.textContent = u.username;
    userSelect.appendChild(opt);
  });

  // first draw
  await refresh();
  refreshBtn.addEventListener("click", refresh);
});

function fail(msg) {
  notAdmin.textContent = msg;
  notAdmin.classList.remove("hidden");
}

async function refresh() {
  const year = yearSelect.value || new Date().getFullYear();
  const userId = userSelect.value || "";

  // 1) Revenue by month
  const monthly = await revenueByMonth(year, userId);
  drawOrUpdate("revenueByMonth", "line", {
    labels: MONTHS,
    datasets: [{
      label: `Revenue ${year}`,
      data: monthly,
      tension: .35,
      fill: true,
      backgroundColor: "rgba(79,70,229,.20)",
      borderColor: "rgba(79,70,229,1)"
    }]
  }, { scales: { y: { beginAtZero: true } } });

  // 2) Sales per user
  const spu = await (await fetch("/api/stats/sales-per-user")).json();
  const labelsU = spu.map(x => x.username);
  const dataU = spu.map(x => x.totalSales);
  drawOrUpdate("salesPerUser", "bar", {
    labels: labelsU,
    datasets: [{ label: "Units", data: dataU, backgroundColor: "rgba(34,197,94,.8)" }]
  }, { scales: { y: { beginAtZero: true } } });

  // 3) Top products
  await renderTopProducts();

  // 4) Low stock
  const products = await (await fetch("/api/products")).json();
  await renderLowStock(products, { topN: 10, threshold: 5, onlyBelow: true });

  // KPIs
  await updateKPIs(products);
}

// ---------- Top Products ----------
async function renderTopProducts() {
  const res = await fetch("/api/stats/top-products");
  const raw = await res.json();
  const withRevenue = await addRevenueIfMissing(raw);

  const metricSel = document.getElementById("topProdMetric");
  const typeSel = document.getElementById("topProdType");
  const topNSel = document.getElementById("topProdN");

  const metric = metricSel?.value || "units";       // 'units' | 'revenue'
  const chartType = typeSel?.value || "doughnut";   // 'doughnut' | 'bar'
  const topN = Number(topNSel?.value || 5);

  const valueKey = metric === "revenue" ? "totalRevenue" : "totalSold";
  const valueFmt = metric === "revenue"
    ? (v) => currency(v)
    : (v) => String(v);
  const titleText = metric === "revenue"
    ? "Top Products by Revenue"
    : "Top Products by Units";

  const sorted = [...withRevenue].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));

  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const othersTotal = rest.reduce((s, r) => s + Number(r[valueKey] || 0), 0);
  if (othersTotal > 0) top.push({ name: "Others", [valueKey]: othersTotal });

  const labels = top.map(t => t.name);
  const data = top.map(t => Number(t[valueKey] || 0));

  const palette = [
    "#60a5fa", "#a78bfa", "#34d399", "#fda4af", "#fbbf24",
    "#38bdf8", "#f472b6", "#86efac", "#fcd34d", "#d4d4d8"
  ];
  const colors = labels.map((_, i) => palette[i % palette.length]);

  const ctx = document.getElementById("topProducts").getContext("2d");
  if (topProductsChart) topProductsChart.destroy();

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: "#cbd5e1" } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || "";
            const v = ctx.parsed;
            return ` ${label}: ${valueFmt(v)}`;
          }
        }
      },
      title: {
        display: true,
        text: titleText,
        color: "#e7edf5",
        font: { weight: "bold", size: 14 }
      }
    }
  };

  if (chartType === "bar") {
    topProductsChart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: metric, data, backgroundColor: colors, borderRadius: 8 }] },
      options: {
        ...commonOpts,
        indexAxis: "y",
        scales: {
          x: {
            grid: { color: "rgba(148,163,184,.15)" },
            ticks: { color: "#9aa6b2", callback: (val) => metric === "revenue" ? currency(val) : val }
          },
          y: { grid: { display: false }, ticks: { color: "#9aa6b2" } }
        }
      }
    });
  } else {
    topProductsChart = new Chart(ctx, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
      options: { ...commonOpts, cutout: "58%" }
    });
    const total = data.reduce((a, b) => a + b, 0);
    drawCenterText(ctx.canvas, metric === "revenue" ? currency(total) : String(total), metric === "revenue" ? "Total Revenue" : "Total Units");
  }

  metricSel?.addEventListener("change", renderTopProducts, { once: true });
  typeSel?.addEventListener("change", renderTopProducts, { once: true });
  topNSel?.addEventListener("change", renderTopProducts, { once: true });
}

// ---------- Low Stock ----------
async function renderLowStock(products, opts = {}) {
  const topN = opts.topN ?? 10;
  const threshold = opts.threshold ?? 5;
  const onlyBelow = opts.onlyBelow ?? true;

  const rows = (products || []).map(p => ({
    name: p.name || '-',
    qty: Number(p.quantity || 0),
    reorder: Number(p.reorderLevel ?? threshold)
  }));

  const filtered = onlyBelow
    ? rows.filter(r => r.qty < (r.reorder || threshold))
    : rows;
  filtered.sort((a, b) => a.qty - b.qty);

  const data = filtered.slice(0, topN);
  const labels = data.map(r => r.name.length > 24 ? r.name.slice(0, 23) + '…' : r.name);
  const quantities = data.map(r => r.qty);
  const colors = data.map(r => {
    const th = r.reorder || threshold;
    if (r.qty < th) return '#ef4444';
    if (r.qty <= th + 2) return '#f59e0b';
    return '#22c55e';
  });

  const dataset = [{ label: 'Qty Remaining', data: quantities, backgroundColor: colors, maxBarThickness: 28, borderRadius: 8 }];

  const hasAnnotation = !!(Chart?.registry?.plugins?.get?.('annotation'));
  const annotations = hasAnnotation ? {
    annotations: {
      threshold: {
        type: 'line',
        xMin: threshold,
        xMax: threshold,
        borderColor: '#94a3b8',
        borderWidth: 2,
        borderDash: [4, 4],
        label: {
          display: true,
          content: `Threshold: ${threshold}`,
          backgroundColor: 'rgba(148,163,184,.12)',
          color: '#64748b',
          position: 'start',
          padding: 4
        }
      }
    }
  } : {};

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
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
          }
        }
      },
      ...(hasAnnotation ? { annotation: annotations } : {})
    },
    scales: {
      x: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.15)' }, ticks: { color: '#cbd5e1' } },
      y: { grid: { display: false }, ticks: { color: '#cbd5e1' } }
    }
  };

  drawOrUpdate('lowStock', 'bar', { labels, datasets: dataset }, options);
}

// ---------- Revenue + KPIs ----------
async function revenueByMonth(year, userId) {
  const monthly = await (await fetch(`/api/stats/sales-by-month?year=${year}`)).json();
  const qs = new URLSearchParams();
  qs.set("startDate", `${year}-01-01`);
  qs.set("endDate", `${year}-12-31`);
  if (userId) qs.set("userId", userId);
  const sales = await (await fetch(`/api/sales?${qs.toString()}`)).json();

  const monthRevenue = Array(12).fill(0);
  sales.forEach(s => {
    const d = new Date(s.date);
    const m = d.getMonth();
    const price = s.product?.price ?? 0;
    monthRevenue[m] += price * s.quantity;
  });
  return monthRevenue.map(v => Math.round(v * 100) / 100);
}

async function updateKPIs(products) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const sales = await (await fetch(`/api/sales?startDate=${start}&endDate=${end}`)).json();

  const revenue = sales.reduce((sum, s) => sum + (s.product?.price || 0) * s.quantity, 0);
  const units = sales.reduce((sum, s) => sum + s.quantity, 0);
  const sellerSet = new Set(sales.map(s => s.soldBy?._id || s.soldBy));
  const lowStockCount = products.filter(p => p.quantity < 5).length;

  kpiRevenue.textContent = `$${revenue.toFixed(2)}`;
  kpiUnits.textContent = units;
  kpiSellers.textContent = sellerSet.size;
  kpiLowStock.textContent = lowStockCount;
}

// ---------- Helpers ----------
function drawOrUpdate(canvasId, type, data, options = {}) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  if (charts[canvasId]) {
    charts[canvasId].data = data;
    charts[canvasId].options = options;
    charts[canvasId].update();
  } else {
    charts[canvasId] = new Chart(ctx, { type, data, options });
  }
}

function currency(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
}

async function addRevenueIfMissing(list) {
  const hasRevenue = list.some(i => typeof i.totalRevenue === "number");
  if (hasRevenue) return list;

  const prodRes = await fetch("/api/products");
  const products = await prodRes.json();
  const priceMap = new Map(products.map(p => [p.name, Number(p.price || 0)]));

  return list.map(p => ({
    ...p,
    totalRevenue: Number(p.totalSold || 0) * (priceMap.get(p.name) ?? 0)
  }));
}

function drawCenterText(canvas, big, small) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  requestAnimationFrame(() => {
    const centerX = width / 2, centerY = height / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 16px Inter, system-ui, sans-serif";
    ctx.fillText(small, centerX, centerY - 4);
    ctx.fillStyle = "#e7edf5";
    ctx.font = "bold 20px Inter, system-ui, sans-serif";
    ctx.fillText(big, centerX, centerY + 20);
    ctx.restore();
  });
}
