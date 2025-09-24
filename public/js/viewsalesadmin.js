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
    const res = await fetch("/api/sales"); // all sales
    const sales = await res.json();

    // figure out if Role column is redundant
    const roleSet = new Set(sales.map((s) => s?.soldBy?.role).filter(Boolean));
    const hideRoleCol = roleSet.size <= 1;

    // table header (add Actions column)
    theadRow.innerHTML = `
      <th>Product</th>
      <th>Qty</th>
      <th>Price</th>
      <th>Total</th>
      <th>Sold By</th>
      ${hideRoleCol ? "" : "<th>Role</th>"}
      <th>Date</th>
      <th>Actions</th>
    `;

    const fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });

    // rows
    tbody.innerHTML = "";
    for (const sale of sales) {
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
        <td>
          <button class="delete-btn" data-id="${sale._id}" title="Delete sale">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    table.style.display = "table";
  } catch (err) {
    console.error("[viewsalesadmin] load error:", err);
    notAdmin.textContent = "❌ Error loading sales.";
    notAdmin.style.display = "block";
  }

  // Event delegation for delete buttons
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (!confirm("Are you sure you want to delete this sale?")) return;

    try {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert("❌ Error: " + (data.error || "Failed to delete"));
        return;
      }
      // remove row from UI
      btn.closest("tr")?.remove();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("❌ Failed to delete sale.");
    }
  });

  // Simple HTML escape helper
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});
