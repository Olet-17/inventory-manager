  window.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Dashboard script loaded");

    const rawUser = localStorage.getItem("user");
    console.log("📦 Raw user:", rawUser);

    if (!rawUser) {
      console.warn("❌ No user found. Redirecting to login...");
      window.location.href = "/html/login.html";
      return;
    }

    const user = JSON.parse(rawUser);
    console.log("✅ Parsed user:", user);

    const roleElement = document.getElementById("userRole");
    if (roleElement) {
      roleElement.textContent = user.role;
    }

    if (user.role === "admin") {
      document.getElementById("adminPanel")?.classList.remove("hidden");
    } else {
      document.getElementById("salesPanel")?.classList.remove("hidden");
    }
  });

  //  document.getElementById("notifBtn").addEventListener("click", async () => {
  //     const dropdown = document.getElementById("notifDropdown");
  //     dropdown.classList.toggle("hidden");

  //     if (!dropdown.classList.contains("hidden")) {
  //       try {
  //         const res = await fetch("/api/notifications");
  //         const data = await res.json();

  //         dropdown.innerHTML = "";

  //         if (data.length === 0) {
  //           dropdown.innerHTML = "<p>No notifications</p>";
  //           return;
  //         }

  //         data.forEach(notif => {
  //           const p = document.createElement("p");
  //           p.textContent = notif.message;
  //           dropdown.appendChild(p);
  //         });

  //       } catch (err) {
  //         dropdown.innerHTML = "<p>Failed to load notifications</p>";
  //       }
  //     }
  //   });


  const bell = document.getElementById("notifBtn");
 const dropdown = document.getElementById("notifDropdown");
dropdown.classList.remove("hidden"); // once on load

  // Ensure the old box (if present) is hidden and unused
  const legacyBox = document.getElementById("notificationBox");
  if (legacyBox) legacyBox.style.display = "none";

  function openDropdown(){ dropdown.classList.add("show"); }
  function closeDropdown(){ dropdown.classList.remove("show"); }
  function toggleDropdown(){
    if (dropdown.classList.contains("show")) closeDropdown();
    else { openDropdown(); renderNotifications(); }
  }

  bell.addEventListener("click", (e) => { e.stopPropagation(); toggleDropdown(); });
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== bell) closeDropdown();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDropdown(); });

  async function renderNotifications(){
    try{
      const res = await fetch("/api/notifications");
      const list = await res.json();

      dropdown.innerHTML = (Array.isArray(list) && list.length)
        ? list.map(n => `
            <div class="notification-item" style="display:flex;gap:8px;align-items:flex-start;padding:6px 2px;border-bottom:1px solid var(--border);">
              <span>🔔</span>
              <div class="notification-message" style="flex:1">${n.message}</div>
              <button class="notification-delete" data-id="${n._id}"
                style="background:transparent;border:1px solid rgba(239,68,68,.35);border-radius:8px;padding:2px 6px;color:#ef4444">
                🗑️
              </button>
            </div>
          `).join("")
        : `<p><em>No notifications</em></p>`;
    }catch{
      dropdown.innerHTML = `<p style="color:#ef4444">⚠️ Failed to load</p>`;
    }
  }
  
  dropdown.addEventListener("click", async (e) => {
    const btn = e.target.closest(".notification-delete");
    if (!btn) return;
    try{
      await fetch(`/api/notifications/${btn.dataset.id}`, { method: "DELETE" });
      renderNotifications();
    }catch{}
  });


//   // js/globalSearch.js
// document.addEventListener("DOMContentLoaded", () => {
//   const searchInput = document.getElementById("globalSearch");

//   if (searchInput) {
//     searchInput.addEventListener("keypress", async (e) => {
//       if (e.key === "Enter") {
//         const query = searchInput.value.trim();
//         if (!query) return;

//         // Example: Send to backend API
//         const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
//         const results = await res.json();

//         // For now, just log results (later we can build a results page or dropdown)
//         console.log("Search results:", results);
//       }
//     });
//   }
// });
// const data = [
//   { type: "page", name: "Manage Products", link: "products.html" },
//   { type: "page", name: "View Sales", link: "sales.html" },
//   { type: "page", name: "Manage Users", link: "users.html" },
//   { type: "page", name: "Analytics", link: "analytics.html" }
// ];

// const input = document.getElementById("globalSearch");
// const resultsBox = document.getElementById("searchResults");

// input.addEventListener("input", () => {
//   const query = input.value.toLowerCase();
//   resultsBox.innerHTML = "";

//   if (!query) {
//     resultsBox.style.display = "none";
//     return;
//   }

//   const results = data.filter(item => item.name.toLowerCase().includes(query));

//   if (results.length === 0) {
//     resultsBox.innerHTML = `<div class="sr-item">No results found</div>`;
//   } else {
//     results.forEach(item => {
//       const div = document.createElement("a");
//       div.href = item.link;
//       div.className = "sr-item";
//       div.innerHTML = `
//         <span class="sr-type">${item.type}</span>
//         <span class="sr-name">${item.name}</span>
//       `;
//       resultsBox.appendChild(div);
//     });
//   }

//   resultsBox.style.display = "block";
// });

