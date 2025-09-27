window.addEventListener("DOMContentLoaded", async () => {
  const productSelect = document.getElementById("productSelect");

  try {
    const res = await fetch("/api/products");
    const products = await res.json();

    products.forEach((product) => {
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
  const quantity = parseInt(document.getElementById("quantity").value, 10);

  // ✅ use sessionStorage (this is what your login.js sets)
  const userId = sessionStorage.getItem("userId");
  if (!userId) {
    alert("User not logged in. Please login again.");
    window.location.href = "/html/login.html";
    return;
  }

  try {
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity, soldBy: userId }), // ✅ correct seller id
    });

    const data = await res.json();
    const msg = document.getElementById("message");

    if (res.ok) {
      msg.textContent = "Sale completed successfully!";
      msg.style.color = "green";
      e.target.reset();
      console.log("Created sale:", data.sale); // populated sale (if you kept my server change)
    } else {
      msg.textContent = data.error || "Failed to complete sale.";
      msg.style.color = "red";
    }
  } catch (err) {
    console.error("Sale error:", err);
    alert("Server error");
  }
});
