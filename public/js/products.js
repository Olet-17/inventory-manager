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

// ===== UTIL: message + escape =====
function showMessage(text, kind = "success") {
  if (!messageEl) return;
  messageEl.textContent = text || "";
  messageEl.classList.remove("success", "error");
  messageEl.classList.add(kind); // expects .success/.error in CSS
  messageEl.style.display = text ? "block" : "none";
}
const escapeHtml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m],
  );

// ===== UTIL: centralized fetch with credentials + auth handling =====
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  // If not authenticated/authorized, bounce to login
  if (res.status === 401 || res.status === 403) {
    // Optional: show a quick message before redirect
    try {
      const err = await res.json();
      console.warn("Auth error:", err);
    } catch {}
    window.location.href = "/html/login.html";
    throw new Error(`Auth required (${res.status})`);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // leave as null, caller can handle
  }
  return { res, data };
}

// ===== LIGHTBOX (create once) =====
function ensureImageModal() {
  const old = document.getElementById("imageModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "imageModal";
  modal.style.cssText = `
    display:none; position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,.85);
    display:flex; justify-content:center; align-items:center;
  `;

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

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.style.display = "none";
  });
}
function openImageModal(src) {
  ensureImageModal();
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  modalImg.src = src;
  modal.style.display = "flex";
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

// Append a single product row (no full re-render)
function appendProductRow(p) {
  const tbody = document.querySelector("#productTable tbody");
  if (!tbody || !p) return;

  const tr = document.createElement("tr");

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
    img.addEventListener("click", () => openImageModal(p.imageUrl));
    tdImg.appendChild(img);
  } else {
    tdImg.textContent = "—";
  }

  const tdName = document.createElement("td");
  tdName.textContent = escapeHtml(p.name);
  const tdPrice = document.createElement("td");
  tdPrice.textContent = String(p.price ?? 0);
  const tdQty = document.createElement("td");
  tdQty.textContent = String(p.quantity ?? 0);

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
  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.style.marginLeft = "8px";
  delBtn.addEventListener("click", () => deleteProduct(p._id));
  tdActions.append(selectBtn, delBtn);

  tr.append(tdImg, tdName, tdPrice, tdQty, tdActions);
  tbody.prepend(tr); // newest first
}

// ===== DATA =====
async function fetchProducts() {
  const { data } = await apiFetch("/api/products");
  return Array.isArray(data) ? data : data?.products || [];
}

async function loadProducts() {
  productsCache = await fetchProducts();
  renderProductTable(productsCache);
  populateProductSelect(productsCache);
  if (productsCache[0]) setCurrentProduct(productsCache[0]._id);
}

// ===== BOOT (require auth via session) =====
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔒 Ask the server who we are (session-based)
    const { res, data } = await apiFetch("/api/auth-sql/me", { method: "GET" });
    // if 401/403, apiFetch already redirected
    const role = String(data?.user?.role || "").toLowerCase();
    if (role !== "admin") {
      notAdmin.style.display = "block";
      return;
    }

    productSection.style.display = "block";
    await loadProducts();
  } catch (error) {
    console.error("Auth/boot error:", error);
    notAdmin.style.display = "block";
  }
});

// ===== FORM: Add product (append row, no reload) =====
productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const sku = document.getElementById("sku").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const quantity = parseInt(document.getElementById("quantity").value, 10);

  if (
    !name ||
    !sku ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    showMessage("Please fill all fields correctly.", "error");
    return;
  }

  const submitBtn = productForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { res, data } = await apiFetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sku, price, quantity }),
    });

    if (!res.ok) {
      showMessage(data?.error || "Failed to add product", "error");
      return;
    }

    const created = data?.product || data;
    if (!created || !created._id) {
      showMessage("Product created, but server did not return an _id", "error");
    }

    productsCache.unshift(created);
    appendProductRow(created);

    if (productSelect) {
      const opt = document.createElement("option");
      opt.value = created._id;
      opt.textContent = `${created.name} (${created.sku || "no sku"})`;
      productSelect.prepend(opt);
    }

    setCurrentProduct(created._id);
    previewImg.style.display = "none";
    uploadMsg.textContent = "";

    showMessage("✅ Product added", "success");
    productForm.reset();

    uploadSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error("Add error:", err);
    showMessage("Server error", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
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
    const { res, data } = await apiFetch(`/api/upload/products/${currentProductId}/image`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      uploadMsg.style.color = "red";
      uploadMsg.textContent = data?.error || "Upload failed";
      return;
    }

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
    const { res, data } = await apiFetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(data?.error || "Failed to delete");
      return;
    }
    productsCache = productsCache.filter((p) => p._id !== id);
    renderProductTable(productsCache);
    populateProductSelect(productsCache);
    if (currentProductId === id) {
      setCurrentProduct(productsCache[0]?._id || null);
      previewImg.style.display = "none";
    }
    alert("Deleted ✅");
  } catch (err) {
    console.error("Delete error:", err);
    alert("Server error");
  }
}
window.deleteProduct = deleteProduct;

console.log("✅ PostgreSQL Products management ready!");
