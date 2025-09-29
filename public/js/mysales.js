document.addEventListener("DOMContentLoaded", async () => {
  // ✅ FIXED: Use localStorage to get userId
  const userId = localStorage.getItem("userId");
  
  if (!userId) {
    document.getElementById("notLoggedIn").style.display = "block";
    return;
  }

  const table = document.getElementById("salesTable");
  const tbody = table.querySelector("tbody");

  try {
    // ✅ FIXED: Use userId parameter to filter sales for current user
    const res = await fetch(`/api/sales?userId=${userId}`);
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
    document.getElementById("notLoggedIn").textContent = "❌ Failed to load sales.";
    document.getElementById("notLoggedIn").style.display = "block";
  }
});

document.getElementById("exportCsvBtn").addEventListener("click", async () => {
  // ✅ FIXED: Check authentication for export too
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("Please log in to export data");
    return;
  }

  try {
    // ✅ FIXED: Export only current user's sales
    const res = await fetch(`/api/sales?userId=${userId}`);
    const data = await res.json();
    
    const headers = ["Product", "Quantity", "Price", "Date"];
    const rows = data.map((sale) => [
      sale.product?.name || "?",
      sale.quantity,
      `$${sale.product?.price || "?"}`,
      new Date(sale.date).toLocaleDateString(),
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "my-sales.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error("Export error:", error);
    alert("Failed to export sales data");
  }
});