let editingId = null;
console.log("✅ products.js loaded");

// ===== DOM =====
const productSection = document.getElementById("productSection");
const notAdmin = document.getElementById("notAdmin");
const productForm = document.getElementById("productForm");
const messageEl = document.getElementById("message");

const productSelect = document.getElementById("productSelect");
const fileInput = document.getElementById("product-image");
const previewImg = document.getElementById("product-image-preview");
const uploadBtn = document.getElementById("upload-image-btn");
const uploadMsg = document.getElementById("uploadMsg");
const uploadSection = document.getElementById("imageUploadSection");

// ===== STATE =====
let productsCache = [];
let currentProductId = null;

// ===== LIGHTBOX (create once) =====
function ensureImageModal() {
  // If a modal exists but has no close button, or you want a fresh one, remove it.
  const old = document.getElementById("imageModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "imageModal";
  modal.style.cssText = `
    display:none; position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,.85);
    display:flex; justify-content:center; align-items:center;
  `;

  // Close button in the overlay (top-right)
  const closeBtn = document.createElement("button");
  closeBtn.id = "imageModalClose";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "✖";
  closeBtn.style.cssText = `
    position: fixed; top: 16px; right: 20px;
    width: 40px; height: 40px; border-radius: 50%;
    display:flex; align-items:center; justify-content:center;
    background: rgba(255,255,255,0.12);
    color: #fff; font-size: 22px; line-height: 1;
    border: 1px solid rgba(255,255,255,0.25);
    cursor: pointer; user-select: none;
    z-index: 10000; transition: background .2s, transform .1s;
  `;
  closeBtn.addEventListener(
    "mouseenter",
    () => (closeBtn.style.background = "rgba(255,255,255,0.2)"),
  );
  closeBtn.addEventListener(
    "mouseleave",
    () => (closeBtn.style.background = "rgba(255,255,255,0.12)"),
  );
  closeBtn.addEventListener("mousedown", () => (closeBtn.style.transform = "scale(0.96)"));
  closeBtn.addEventListener("mouseup", () => (closeBtn.style.transform = "scale(1)"));
  closeBtn.addEventListener("click", () => (modal.style.display = "none"));

  const img = document.createElement("img");
  img.id = "modalImg";
  img.alt = "Product Preview";
  img.style.cssText = `
    max-width: 90%; max-height: 90%;
    border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,.5);
  `;

  modal.appendChild(closeBtn);
  modal.appendChild(img);
  document.body.appendChild(modal);

  // Close if background clicked (not the image or the button)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
  // Close on Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.style.display = "none";
  });
}

// ===== OPEN MODAL =====
function openImageModal(src) {
  ensureImageModal();
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  modalImg.src = src;
  modal.style.display = "flex"; // flex so image stays centered
}

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
      img.style.maxHeight = "70px";
      img.style.borderRadius = "6px";
      img.style.objectFit = "cover";
      img.style.cursor = "pointer";
      // 🔍 click to open modal
      img.addEventListener("click", () => openImageModal(p.imageUrl));
      tdImg.appendChild(img);
    } else {
      tdImg.textContent = "—";
    }

    // Name / Price / Qty
    const tdName = document.createElement("td");
    tdName.textContent = p.name || "";
    const tdPrice = document.createElement("td");
    tdPrice.textContent = `${p.price ?? 0}`;
    const tdQty = document.createElement("td");
    tdQty.textContent = `${p.quantity ?? 0}`;

    // Actions
    const tdActions = document.createElement("td");
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.addEventListener("click", () => {
      setCurrentProduct(p._id);
      if (p.imageUrl) {
        previewImg.src = p.imageUrl;
        previewImg.style.display = "block";
      } else {
        previewImg.style.display = "none";
      }
      uploadMsg.textContent = "";
      uploadSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    tdActions.appendChild(selectBtn);

    // (optional) Delete button
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.style.marginLeft = "8px";
    delBtn.addEventListener("click", () => deleteProduct(p._id));
    tdActions.appendChild(delBtn);

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
  // support either array or { products: [...] }
  return Array.isArray(data) ? data : data.products || [];
}

async function loadProducts() {
  productsCache = await fetchProducts();
  renderProductTable(productsCache);
  populateProductSelect(productsCache);
  if (productsCache[0]) setCurrentProduct(productsCache[0]._id);
}

// ===== BOOT =====
window.addEventListener("DOMContentLoaded", async () => {
  // ✅ FIXED: Check authentication first
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "/html/login.html";
    return;
  }

  // ✅ CHANGED: Use PostgreSQL auth endpoint
  try {
    const userRes = await fetch("/api/auth-sql/user-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId }),
    });

    const userData = await userRes.json();

    // ✅ CHANGED: Check userData.user.role (PostgreSQL format)
    if (!userData.user || userData.user.role !== "admin") {
      notAdmin.style.display = "block";
      return;
    }

    productSection.style.display = "block";
    await loadProducts();
  } catch (error) {
    console.error("Authentication error:", error);
    notAdmin.style.display = "block";
  }
});

// ===== FORM: Add product =====
productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const sku = document.getElementById("sku").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const quantity = parseInt(document.getElementById("quantity").value, 10);

  // Add validation for SKU
  if (!sku) {
    messageEl.textContent = "SKU is required";
    messageEl.style.color = "red";
    return;
  }

  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sku, price, quantity }),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.textContent = data.error || "Failed to add product";
      messageEl.style.color = "red";
      return;
    }

    const created = data.product || data;
    if (!created || !created._id) {
      messageEl.textContent = "Product created, but server did not return an _id";
      messageEl.style.color = "orange";
    }

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

  try {
    const resp = await fetch(`/api/upload/products/${currentProductId}/image`, {
      method: "POST",
      body: fd,
    });
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
  } catch (error) {
    console.error("Upload error:", error);
    uploadMsg.style.color = "red";
    uploadMsg.textContent = "Upload failed";
  }
});

// ===== DELETE PRODUCT =====
async function deleteProduct(id) {
  if (!confirm("Are you sure?")) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      productsCache = productsCache.filter((p) => p._id !== id);
      renderProductTable(productsCache);
      populateProductSelect(productsCache);
      if (currentProductId === id) {
        setCurrentProduct(productsCache[0]?._id || null);
        previewImg.style.display = "none";
      }
      alert("Deleted ✅");
    } else {
      alert(data.error || "Failed to delete");
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("Server error");
  }
}
window.deleteProduct = deleteProduct;

console.log("✅ PostgreSQL Products management ready!");
