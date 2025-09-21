document.addEventListener("DOMContentLoaded", async () => {
  const me = JSON.parse(localStorage.getItem("user"));
  const notAdmin = document.getElementById("notAdmin");
  const table = document.getElementById("salesTable");
  const theadRow = table.querySelector("thead tr");
  const tbody = table.querySelector("tbody");

  if (!me || me.role !== "admin") {
    notAdmin.textContent = "❌ Access denied. Admins only.";
    notAdmin.style.display = "block";
    return;
  }

  try {
    const res = await fetch("/api/sales");            // all sales (no filter)
    const sales = await res.json();

    // Collect roles present in payload (so we can hide role column if redundant)
    const roleSet = new Set(
      sales.map(s => (s.soldBy && s.soldBy.role) ? s.soldBy.role : null)
           .filter(Boolean)
    );
    const hideRoleCol = roleSet.size <= 1;            // If all same (e.g., all "admin"), hide the column

    // Rebuild table header based on whether we hide the Role column
    theadRow.innerHTML = `
      <th>Product</th>
      <th>Qty</th>
      <th>Price</th>
      <th>Total</th>
      <th>Sold By</th>
      ${hideRoleCol ? "" : "<th>Role</th>"}
      <th>Date</th>
    `;

    // Build rows
    const fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    });

    tbody.innerHTML = "";
    sales.forEach(sale => {
      const name = sale.product?.name ?? "-";
      const qty = Number(sale.quantity || 0);
      const price = Number(sale.product?.price || 0);
      const total = price * qty;
      const seller = sale.soldBy?.username ?? "-";
      const role = sale.soldBy?.role ?? "-";
      const dateStr = new Date(sale.date).toLocaleDateString();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(name)}</td>
        <td>${qty}</td>
        <td>${price ? fmt.format(price) : "-"}</td>
        <td>${fmt.format(total)}</td>
        <td>${escapeHtml(seller)}</td>
        ${hideRoleCol ? "" : `<td>${escapeHtml(role)}</td>`}
        <td>${dateStr}</td>
      `;
      tbody.appendChild(tr);
    });

    table.style.display = "table";
  } catch (err) {
    console.error("[viewsalesadmin] load error:", err);
    notAdmin.textContent = "❌ Error loading sales.";
    notAdmin.style.display = "block";
  }

  // Simple HTML escape helper
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});
