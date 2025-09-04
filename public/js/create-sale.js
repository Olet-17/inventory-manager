window.addEventListener("DOMContentLoaded", async () => {
    const productSelect = document.getElementById("productSelect");
  
    try {
      const res = await fetch("/api/products");
      const products = await res.json();
  
      products.forEach(product => {
        const option = document.createElement("option");
        option.value = product._id;
        option.textContent = `${product.name} (Stock: ${product.quantity})`;
        productSelect.appendChild(option);
      });
    } catch (err) {
      alert("Failed to load products");
    }
  });
  
  document.getElementById("saleForm").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const productId = document.getElementById("productSelect").value;
    const quantity = parseInt(document.getElementById("quantity").value);
    const user = JSON.parse(localStorage.getItem("user"));
  
    if (!user || !user.id) {
      alert("User not logged in. Please login again.");
      window.location.href = "login.html";
      return;
    }
  
    const soldBy = user.id;
  
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ productId, quantity, soldBy })
    });
  
    const data = await res.json();
    const msg = document.getElementById("message");
  
    if (res.ok) {
      msg.textContent = "Sale completed successfully!";
      msg.style.color = "green";
      e.target.reset();
    } else {
      msg.textContent = data.error || "Failed to complete sale.";
      msg.style.color = "red";
    }
  });
  