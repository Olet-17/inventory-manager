let editingId = null;

console.log("✅ products.js loaded");





window.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const productSection = document.getElementById("productSection");
  const notAdmin = document.getElementById("notAdmin");

  // ⛔ Admin check
  if (!user || user.role !== "admin") {
    notAdmin.style.display = "block";
    return;
  }

  productSection.style.display = "block";

  loadProducts();

  // 🆕 Form submit
  document.getElementById("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const price = parseFloat(document.getElementById("price").value);
    const quantity = parseInt(document.getElementById("quantity").value);
    const message = document.getElementById("message");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, quantity })
      });

      const data = await res.json();

      if (res.ok) {
        message.textContent = "✅ Product added";
        message.style.color = "green";
        e.target.reset();
        loadProducts();
      } else {
        message.textContent = data.error || "Failed to add product";
        message.style.color = "red";
      }
    } catch (err) {
      console.error("Add error:", err);
      message.textContent = "Server error";
      message.style.color = "red";
    }
  });
});

async function loadProducts() {
  const tbody = document.querySelector("#productTable tbody");
  tbody.innerHTML = "";

  try {
    const res = await fetch("/api/products");
    const products = await res.json();

    products.forEach(product => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${product.name}</td>
        <td>$${product.price}</td>
        <td>${product.quantity}</td>
        <td>
          <button onclick="deleteProduct('${product._id}')">Delete</button>
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Load error:", err);
  }
}

async function deleteProduct(id) {
  if (!confirm("Are you sure?")) return;

  try {
    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (res.ok) {
      alert("Deleted ✅");
      loadProducts();
    } else {
      alert(data.error || "Failed to delete");
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("Server error");
  }
}
