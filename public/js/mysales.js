document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user || !user.id) {
    document.getElementById("notLoggedIn").style.display = "block";
    return;
  }

  const table = document.getElementById("salesTable");
  const tbody = table.querySelector("tbody");

  try {
    const res = await fetch(`/api/sales?userId=${user.id}`);
    const sales = await res.json();

    if (!Array.isArray(sales)) throw new Error("Invalid response");

    table.style.display = "table";

    sales.forEach((sale) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${sale.product?.name || "?"}</td>
        <td>${sale.quantity}</td>
        <td>$${sale.product?.price || "?"}</td>
        <td>${new Date(sale.date).toLocaleDateString()}</td>
      `;

      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to load sales:", err);
    document.getElementById("notLoggedIn").textContent =
      "❌ Failed to load sales.";
    document.getElementById("notLoggedIn").style.display = "block";
  }
});
document.getElementById("exportCsvBtn").addEventListener("click", () => {
  fetch("/api/sales")
    .then((res) => res.json())
    .then((data) => {
      const headers = ["Product", "Quantity", "Date", "Sold By"];
      const rows = data.map((sale) => [
        sale.product.name,
        sale.quantity,
        new Date(sale.date).toLocaleDateString(),
        sale.soldBy.username,
      ]);

      let csvContent =
        "data:text/csv;charset=utf-8," +
        [headers, ...rows].map((e) => e.join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "sales.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
});
