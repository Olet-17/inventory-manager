document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user || user.role !== "admin") {
    document.getElementById("notAdmin").style.display = "block";
    return;
  }

  const table = document.getElementById("salesTable");
  const tbody = table.querySelector("tbody");

  try {
    const res = await fetch("/api/sales");
    const sales = await res.json();

    table.style.display = "table";

    sales.forEach(sale => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${sale.product?.name || "-"}</td>
        <td>${sale.quantity}</td>
        <td>$${sale.product?.price?.toFixed(2) || "-"}</td>
        <td>${sale.soldBy?.username || "-"}</td>
        <td>${sale.soldBy?.role || "-"}</td>
        <td>${new Date(sale.date).toLocaleDateString()}</td>
      `;

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("Failed to load sales:", err);
    document.getElementById("notAdmin").textContent = "❌ Error loading sales.";
  }
});
