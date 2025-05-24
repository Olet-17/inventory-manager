async function fetchProducts() {
  const res = await fetch("/api/products");
  const products = await res.json();

  const table = document.querySelector("#productTable tbody");
  table.innerHTML = "";

  products.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.price}</td>
      <td>${product.quantity}</td>
      <td>
        <button onclick="editProduct('${product._id}')">Edit</button>
        <button onclick="deleteProduct('${product._id}')">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });
}

async function deleteProduct(id) {
  if (confirm("Are you sure you want to delete this product?")) {
    await fetch(`/api/products/${id}`, {
      method: "DELETE",
    });
    fetchProducts();
  }
}

function editProduct(id) {
  alert(`Edit form to be added for ID: ${id}`);
  // Or redirect to edit-product.html?id=...
}

window.onload = fetchProducts;
