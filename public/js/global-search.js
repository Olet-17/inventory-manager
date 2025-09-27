// Global Search (client-side merge of /products, /users, /sales) — instrumented
window.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("globalSearch");
  const results = document.getElementById("searchResults");
  if (!input || !results) return;

  console.log("[search] loaded");

  results.style.position = results.style.position || "absolute";

  let debounceTimer;
  let activeIndex = -1;
  let flatItems = [];

  const escapeHtml = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hi = (label, q) => {
    if (!q) return escapeHtml(label);
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    return escapeHtml(label).replace(re, "<mark>$1</mark>");
  };

  function open() {
    results.classList.add("show");
    input.setAttribute("aria-expanded", "true");
  }
  function close() {
    results.classList.remove("show");
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  async function safeJson(url, signal) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        console.warn(`[search] ${url} -> HTTP ${res.status}`);
        return { ok: false, data: [], status: res.status };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      console.warn(`[search] ${url} failed:`, err);
      return { ok: false, data: [], error: String(err) };
    }
  }

  async function fetchAll(signal) {
    const [p, u, s] = await Promise.all([
      safeJson("/api/products", signal),
      safeJson("/api/users", signal),
      safeJson("/api/sales", signal),
    ]);
    console.log("[search] counts:", {
      products: p.data?.length || 0,
      users: u.data?.length || 0,
      sales: s.data?.length || 0,
    });

    // show a quick message if endpoints are down
    const down = [];
    if (!p.ok) down.push("products");
    if (!u.ok) down.push("users");
    if (!s.ok) down.push("sales");
    if (down.length) {
      results.innerHTML = `<div class="sr-error">Some data sources unavailable: ${down.join(", ")}</div>`;
      open();
    }

    return {
      products: Array.isArray(p.data) ? p.data : [],
      users: Array.isArray(u.data) ? u.data : [],
      sales: Array.isArray(s.data) ? s.data : [],
    };
  }

  function render(data, q) {
    flatItems = [];
    results.innerHTML = "";

    const qlc = q.toLowerCase();
    const products = (data.products || [])
      .filter((p) => (p.name || "").toLowerCase().includes(qlc))
      .slice(0, 8);
    const users = (data.users || [])
      .filter(
        (u) =>
          (u.username || "").toLowerCase().includes(qlc) ||
          (u.email || "").toLowerCase().includes(qlc),
      )
      .slice(0, 8);
    const sales = (data.sales || [])
      .filter((s) => {
        const pname = s.product?.name || "";
        const seller = s.soldBy?.username || "";
        return pname.toLowerCase().includes(qlc) || seller.toLowerCase().includes(qlc);
      })
      .slice(0, 8);

    // Fallback: if all three are empty but query is short, hint user
    const total = products.length + users.length + sales.length;
    if (!total) {
      results.innerHTML = `<div class="sr-empty">No results for “${escapeHtml(q)}”. Try another keyword.</div>`;
      open();
      return;
    }

    const groups = [
      [
        "Products",
        products,
        (p) =>
          `<span class="sr-icon">📦</span><span class="sr-label">${hi(p.name, q)} • $${p.price ?? "-"} • Qty: ${p.quantity ?? "-"}</span>`,
        () => (location.href = "/html/products.html"),
      ],
      [
        "Sales",
        sales,
        (s) =>
          `<span class="sr-icon">🧾</span><span class="sr-label">${hi(s.product?.name || "-", q)} • ${s.quantity} pcs • by ${s.soldBy?.username || "-"}</span>`,
        () => (location.href = "/html/viewsalesadmin.html"),
      ],
      [
        "Users",
        users,
        (u) =>
          `<span class="sr-icon">👤</span><span class="sr-label">${hi(u.username, q)} • ${u.role || "-"}</span>`,
        () => (location.href = "/html/manage-users.html"),
      ],
    ];

    groups.forEach(([title, arr, tpl, nav]) => {
      if (!arr.length) return;
      const sec = document.createElement("div");
      sec.className = "sr-group";
      sec.innerHTML = `<div class="sr-group-title">${title}</div>`;
      arr.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sr-item";
        btn.innerHTML = tpl(item);
        btn.addEventListener("click", nav);
        sec.appendChild(btn);
        flatItems.push(btn);
      });
      results.appendChild(sec);
    });
    open();
  }

  function move(delta) {
    if (!results.classList.contains("show") || flatItems.length === 0) return;
    activeIndex += delta;
    if (activeIndex < 0) activeIndex = flatItems.length - 1;
    if (activeIndex >= flatItems.length) activeIndex = 0;
    flatItems.forEach((el, i) => {
      el.classList.toggle("active", i === activeIndex);
      if (i === activeIndex) el.scrollIntoView({ block: "nearest" });
    });
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (q.length < 2) {
      close();
      results.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        results.innerHTML = `<div class="sr-loading">Searching…</div>`;
        open();
        const controller = new AbortController();
        const data = await fetchAll(controller.signal);
        render(data, q);
      } catch (e) {
        console.error("[search] error", e);
        results.innerHTML = `<div class="sr-error">Search failed</div>`;
        open();
      }
    }, 200);
  });

  input.addEventListener("focus", () => {
    if (results.innerHTML.trim()) open();
  });

  document.addEventListener("click", (e) => {
    if (!results.contains(e.target) && e.target !== input) close();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      if (results.classList.contains("show") && activeIndex >= 0 && flatItems[activeIndex]) {
        e.preventDefault();
        flatItems[activeIndex].click();
      }
    } else if (e.key === "Escape") {
      close();
    }
  });
});
