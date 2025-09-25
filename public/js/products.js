let editingId = null;
console.log("✅ products.js loaded");

// ===== DOM =====
const productSection = document.getElementById("productSection");
const notAdmin       = document.getElementById("notAdmin");
const productForm    = document.getElementById("productForm");
const messageEl      = document.getElementById("message");

const productSelect  = document.getElementById("productSelect");
const fileInput      = document.getElementById("product-image");
const previewImg     = document.getElementById("product-image-preview");
const uploadBtn      = document.getElementById("upload-image-btn");
const uploadMsg      = document.getElementById("uploadMsg");
const uploadSection  = document.getElementById("imageUploadSection");

// ===== STATE =====
let productsCache = [];
let currentProductId = null;

// ===== HELPERS =====
function setCurrentProduct(id) {
  currentProductId = id || null;
  if (productSelect) productSelect.value = currentProductId || "";
}

function populateProductSelect(items) {
  if (!productSelect) return;
  productSelect.innerHTML = "";
  for (const p of items) {
    const opt = document.createElement("option");
    opt.value = p._id;
    opt.textContent = `${p.name} (${p.sku || "no sku"})`;
    productSelect.appendChild(opt);
  }
}

function renderProductTable(items) {
  const tbody = document.querySelector("#productTable tbody");
  tbody.innerHTML = "";

  items.forEach((p) => {
    const tr = document.createElement("tr");

    // Image
    const tdImg = document.createElement("td");
    if (p.imageUrl) {
      const img = document.createElement("img");
      img.src = p.imageUrl;
      img.alt = "product";
      img.style.maxWidth = "70px";
      tdImg.appendChild(img);
    } else {
      tdImg.textContent = "—";
    }

    // Name / Price / Qty
    const tdName = document.createElement("td"); tdName.textContent = p.name || "";
    const tdPrice = document.createElement("td"); tdPrice.textContent = `${p.price ?? 0}`;
    const tdQty = document.createElement("td"); tdQty.textContent = `${p.quantity ?? 0}`;

    // Actions
    const tdActions = document.createElement("td");
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.addEventListener("click", () => {
      setCurrentProduct(p._id);
      if (p.imageUrl) { previewImg.src = p.imageUrl; previewImg.style.display = "block"; }
      else { previewImg.style.display = "none"; }
      uploadMsg.textContent = "";
      uploadSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    tdActions.appendChild(selectBtn);

    tr.appendChild(tdImg);
    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdQty);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

async function fetchProducts() {
  const res = await fetch("/api/products");
  const data = await res.json();
  // support either array or {products:[...]}
  return Array.isArray(data) ? data : (data.products || []);
}

async function loadProducts() {
  productsCache = await fetchProducts();
  renderProductTable(productsCache);
  populateProductSelect(productsCache);
  if (productsCache[0]) setCurrentProduct(productsCache[0]._id);
}

// ===== BOOT =====
window.addEventListener("DOMContentLoaded", async () => {
  // Admin gate
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || user.role !== "admin") {
    notAdmin.style.display = "block";
    return;
  }
  productSection.style.display = "block";

  await loadProducts();
});

// ===== FORM: Add product =====
productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const quantity = parseInt(document.getElementById("quantity").value, 10);

  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price, quantity }),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.textContent = data.error || "Failed to add product";
      messageEl.style.color = "red";
      return;
    }

    // try {product: {...}} or plain object
    const created = data.product || data;
    if (!created || !created._id) {
      messageEl.textContent = "Product created, but server did not return an _id";
      messageEl.style.color = "orange";
    }

    // update caches/UI
    productsCache.unshift(created);
    renderProductTable(productsCache);
    populateProductSelect(productsCache);

    setCurrentProduct(created._id);
    previewImg.style.display = "none";
    uploadMsg.textContent = "";

    messageEl.textContent = "✅ Product added";
    messageEl.style.color = "green";
    productForm.reset();

    uploadSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error("Add error:", err);
    messageEl.textContent = "Server error";
    messageEl.style.color = "red";
  }
});

// ===== IMAGE: select different product =====
productSelect?.addEventListener("change", () => {
  setCurrentProduct(productSelect.value || null);
  const p = productsCache.find((x) => x._id === currentProductId);
  if (p?.imageUrl) {
    previewImg.src = p.imageUrl;
    previewImg.style.display = "block";
  } else {
    previewImg.style.display = "none";
  }
});

// ===== IMAGE: preview chosen file =====
fileInput?.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  previewImg.src = url;
  previewImg.style.display = "block";
});

// ===== IMAGE: upload to server =====
uploadBtn?.addEventListener("click", async () => {
  if (!currentProductId) {
    uploadMsg.style.color = "red";
    uploadMsg.textContent = "Choose a product first.";
    return;
  }
  const f = fileInput.files?.[0];
  if (!f) {
    uploadMsg.style.color = "red";
    uploadMsg.textContent = "Choose an image first.";
    return;
  }

  const fd = new FormData();
  fd.append("image", f);

  const resp = await fetch(`/api/products/${currentProductId}/image`, { method: "POST", body: fd });
  const data = await resp.json();
  if (!resp.ok) {
    uploadMsg.style.color = "red";
    uploadMsg.textContent = data.error || "Upload failed";
    return;
  }

  // update cache + UI
  const idx = productsCache.findIndex((p) => p._id === currentProductId);
  if (idx >= 0) productsCache[idx].imageUrl = data.imageUrl;

  renderProductTable(productsCache);
  previewImg.src = data.imageUrl;
  previewImg.style.display = "block";
  uploadMsg.style.color = "green";
  uploadMsg.textContent = "Image uploaded!";
});

// ===== DELETE PRODUCT (kept from your version) =====
async function deleteProduct(id) {
  if (!confirm("Are you sure?")) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      alert("Deleted ✅");
      productsCache = productsCache.filter((p) => p._id !== id);
      renderProductTable(productsCache);
      populateProductSelect(productsCache);
      if (currentProductId === id) {
        setCurrentProduct(productsCache[0]?._id || null);
        previewImg.style.display = "none";
      }
    } else {
      alert(data.error || "Failed to delete");
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("Server error");
  }
}
window.deleteProduct = deleteProduct; // expose for inline onclick
