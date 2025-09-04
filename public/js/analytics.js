// window.addEventListener("DOMContentLoaded", async () => {
//   const userId = sessionStorage.getItem("userId");
//   const notAdmin = document.getElementById("notAdmin");
//   const chartsSection = document.getElementById("chartsSection");

//   if (!userId) {
//     return showError("❌ You must be logged in.");
//   }

//   try {
//     const res = await fetch(`/api/user/${userId}`);
//     const data = await res.json();

//     if (!res.ok || !data.user || data.user.role !== "admin") {
//       return showError("❌ Access denied. Admins only.");
//     }

//     chartsSection.style.display = "block";

//     // ✅ 1. Sales Per Month (Real)
//     await renderSalesByMonth();

//     // ✅ 2. Sales Per User (Real)
//     const userSalesRes = await fetch("/api/stats/sales-per-user");
//     const userSalesData = await userSalesRes.json();

//     const userLabels = userSalesData.map(entry => entry.username);
//     const userValues = userSalesData.map(entry => entry.totalSales);

//     renderBarChart("salesPerUser", "Total Sales per User", userLabels, userValues, "#2ecc71");

//     // ✅ 3. Top Products (Real)
//     const topProductsRes = await fetch("/api/stats/top-products");
//     const topProductsData = await topProductsRes.json();

//     const productLabels = topProductsData.map(p => p.name);
//     const productValues = topProductsData.map(p => p.totalSold);
//     const productColors = productLabels.map((_, i) =>
//       ["#f39c12", "#e74c3c", "#9b59b6", "#1abc9c", "#2ecc71"][i % 5]
//     );

//     renderPieChart("topProducts", "Most Sold Products", productLabels, productValues, productColors);

//     // ✅ 4. Role Breakdown (Dummy – replace later with real data if needed)
//    // 🔹 Role Breakdown - Real
// const roleRes = await fetch("/api/stats/role-breakdown");
// const roleData = await roleRes.json();

// const roleLabels = roleData.map(r => r._id);
// const roleCounts = roleData.map(r => r.count);
// const roleColors = roleLabels.map((role) =>
//   role === "admin" ? "#1abc9c" : "#e74c3c"
// );

// renderDoughnutChart("roleBreakdown", "User Roles", roleLabels, roleCounts, roleColors);


//   } catch (err) {
//     console.error("❌ Analytics load error:", err);
//     showError("⚠️ Failed to load analytics.");
//   }

//   // 🔧 Helper functions
//   function showError(message) {
//     notAdmin.textContent = message;
//     notAdmin.style.display = "block";
//   }

//   async function renderSalesByMonth(year = new Date().getFullYear()) {
//     const res = await fetch(`/api/stats/sales-by-month?year=${year}`);
//     const stats = await res.json();

//     new Chart(document.getElementById("salesByMonth"), {
//       type: "bar",
//       data: {
//         labels: [
//           "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
//         ],
//         datasets: [{
//           label: `Sales in ${stats.year}`,
//           data: stats.sales,
//           backgroundColor: "#3498db"
//         }]
//       },
//       options: {
//         responsive: true,
//         scales: {
//           y: { beginAtZero: true }
//         }
//       }
//     });
//   }

//   function renderBarChart(canvasId, label, labels, data, color) {
//     new Chart(document.getElementById(canvasId), {
//       type: "bar",
//       data: {
//         labels,
//         datasets: [{
//           label,
//           data,
//           backgroundColor: color
//         }]
//       },
//       options: {
//         responsive: true,
//         scales: {
//           y: { beginAtZero: true }
//         }
//       }
//     });
//   }

//   function renderPieChart(canvasId, label, labels, data, colors) {
//     new Chart(document.getElementById(canvasId), {
//       type: "pie",
//       data: {
//         labels,
//         datasets: [{
//           label,
//           data,
//           backgroundColor: colors
//         }]
//       },
//       options: {
//         responsive: true
//       }
//     });
//   }

//   function renderDoughnutChart(canvasId, label, labels, data, colors) {
//     new Chart(document.getElementById(canvasId), {
//       type: "doughnut",
//       data: {
//         labels,
//         datasets: [{
//           label,
//           data,
//           backgroundColor: colors
//         }]
//       },
//       options: {
//         responsive: true
//       }
//     });
//   }
// });


// Helper: month labels
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

// Init
window.addEventListener("DOMContentLoaded", async () => {
  // auth check
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

  // draw
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

  // 1) Revenue by month (sum of price*qty)
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

  // 2) Sales per user (quantities)
  const spu = await (await fetch("/api/stats/sales-per-user")).json();
  const labelsU = spu.map(x => x.username);
  const dataU = spu.map(x => x.totalSales);
  drawOrUpdate("salesPerUser", "bar", {
    labels: labelsU,
    datasets: [{ label: "Units", data: dataU, backgroundColor: "rgba(34,197,94,.8)" }]
  }, { scales: { y: { beginAtZero: true } } });

  // 3) Top products (qty)
  const top = await (await fetch("/api/stats/top-products")).json();
  const labelsP = top.map(x => x.name);
  const dataP = top.map(x => x.totalSold);
  drawOrUpdate("topProducts", "pie", {
    labels: labelsP,
    datasets: [{ data: dataP, backgroundColor: palette(labelsP.length) }]
  });

  // 4) Low stock (first 6 ascending)
  const products = await (await fetch("/api/products")).json();
  const low = products.slice().sort((a,b) => a.quantity - b.quantity).slice(0, 6);
  drawOrUpdate("lowStock", "bar", {
    labels: low.map(p => p.name),
    datasets: [{ label: "Qty Remaining", data: low.map(p => p.quantity), backgroundColor: "rgba(239,68,68,.8)" }]
  }, { indexAxis: 'y', plugins: { legend: { display:false } }, scales: { x:{ beginAtZero:true } } });

  // KPIs (this month)
  await updateKPIs(products);
}

// Revenue by month via your existing endpoints
async function revenueByMonth(year, userId) {
  // get monthly quantities
  const monthly = await (await fetch(`/api/stats/sales-by-month?year=${year}`)).json();
  // get all sales for revenue calc (filtering by year & optional user)
  const qs = new URLSearchParams();
  qs.set("startDate", `${year}-01-01`);
  qs.set("endDate", `${year}-12-31`);
  if (userId) qs.set("userId", userId);
  const sales = await (await fetch(`/api/sales?${qs.toString()}`)).json();

  // build a map productId -> price from populated results
  // (sales[].product has {name, price} because you populate)
  const monthRevenue = Array(12).fill(0);
  sales.forEach(s => {
    const d = new Date(s.date);
    const m = d.getMonth();
    const price = s.product?.price ?? 0;
    monthRevenue[m] += price * s.quantity;
  });
  // Fallback to quantities if you want to show both:
  // return monthly.sales; // <- quantities only
  return monthRevenue.map(v => Math.round(v * 100) / 100);
}

async function updateKPIs(products) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59).toISOString();

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

// chart helper
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

// simple palette
function palette(n){
  const base = ["#60a5fa","#a78bfa","#f472b6","#fb7185","#f59e0b","#34d399","#22d3ee","#f87171"];
  const out = [];
  for(let i=0;i<n;i++) out.push(base[i % base.length]);
  return out;
}
