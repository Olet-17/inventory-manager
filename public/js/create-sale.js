// create-sale.js

let productsCache = [];
const selected = new Map(); // productId -> quantity

const tbody = () => document.querySelector("#productTable tbody");
const summaryEl = () => document.getElementById("summary");
const msgEl = () => document.getElementById("message");

function updateSummary() {
  const items = Array.from(selected.entries());
  if (!items.length) {
    summaryEl().textContent = "";
    return;
  }
  let total = 0;
  for (const [id, q] of items) {
    const p = productsCache.find((x) => x._id === id);
    if (p) total += (Number(p.price) || 0) * q;
  }
  summaryEl().textContent = `Items: ${items.length} • Total: $${total.toFixed(2)}`;
}

function setSelected(id, qty) {
  if (qty > 0) selected.set(id, qty);
  else selected.delete(id);
  updateSummary();
}

function renderProducts(list) {
  const body = tbody();
  body.innerHTML = "";

  for (const p of list) {
    const tr = document.createElement("tr");

    // pick
    const tdPick = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selected.has(p._id);
    tdPick.appendChild(cb);

    // name
    const tdName = document.createElement("td");
    tdName.textContent = p.name || "";

    // price
    const tdPrice = document.createElement("td");
    tdPrice.textContent = `$${Number(p.price || 0)}`;

    // stock
    const tdStock = document.createElement("td");
    tdStock.textContent = String(p.quantity ?? 0);

    // qty (enabled when checked)
    const tdQty = document.createElement("td");
    const qty = document.createElement("input");
    qty.type = "number";
    qty.min = "1";
    qty.value = selected.get(p._id) || 1;
    qty.style.width = "80px";
    qty.disabled = !cb.checked;
    tdQty.appendChild(qty);

    cb.addEventListener("change", () => {
      qty.disabled = !cb.checked;
      if (cb.checked) {
        const q = Math.max(1, parseInt(qty.value || "1", 10));
        setSelected(p._id, q);
      } else {
        setSelected(p._id, 0);
      }
    });

    qty.addEventListener("input", () => {
      let q = Math.max(1, parseInt(qty.value || "1", 10));
      if (Number.isFinite(p.quantity)) q = Math.min(q, p.quantity); // cap by stock
      qty.value = q;
      if (cb.checked) setSelected(p._id, q);
    });

    tr.appendChild(tdPick);
    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdStock);
    tr.appendChild(tdQty);
    body.appendChild(tr);
  }

  updateSummary();
}

window.addEventListener("DOMContentLoaded", async () => {
  // ✅ FIXED: Check authentication first
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "/html/login.html";
    return;
  }

  try {
    const res = await fetch("/api/products");
    productsCache = await res.json();
    renderProducts(productsCache);
  } catch {
    alert("Failed to load products");
  }
});

document.getElementById("submitSale").addEventListener("click", async () => {
  const items = Array.from(selected.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  // ✅ FIXED: Use localStorage instead of sessionStorage
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("User not logged in. Please login again.");
    location.href = "/html/login.html";
    return;
  }

  if (!items.length) {
    msgEl().style.color = "orange";
    msgEl().textContent = "Pick at least one product.";
    return;
  }

  msgEl().style.color = "#9ca3af";
  msgEl().textContent = "Processing...";

  try {
    const resp = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, soldBy: userId }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      msgEl().style.color = "red";
      msgEl().textContent = data.error || "Sale failed.";
      return;
    }

    // reset UI and reload products to reflect new stock
    selected.clear();
    msgEl().style.color = "green";
    msgEl().textContent = "Sale completed ✅";
    const res2 = await fetch("/api/products");
    productsCache = await res2.json();
    renderProducts(productsCache);
  } catch (e) {
    console.error(e);
    msgEl().style.color = "red";
    msgEl().textContent = "Server error.";
  }
});
