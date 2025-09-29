window.addEventListener("DOMContentLoaded", () => {
  console.log("🔍 DEBUG: Dashboard script loaded");
  
  // Debug all storage
  console.log("📦 sessionStorage contents:");
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    console.log("  ", key + " = " + sessionStorage.getItem(key));
  }
  
  console.log("📦 localStorage contents:");
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    console.log("  ", key + " = " + localStorage.getItem(key));
  }

  // ✅ FIXED: Look for userId in localStorage instead of sessionStorage
  const userId = localStorage.getItem("userId");
  console.log("🎯 Retrieved userId from localStorage:", userId);

  if (!userId) {
    console.error("❌ DEBUG: No userId found in localStorage!");
    console.error("❌ Redirecting to login...");
    window.location.href = "/html/login.html";
    return;
  }

  console.log("✅ DEBUG: UserId found, proceeding to fetch user data");
  fetchUserData(userId);
});

async function fetchUserData(userId) {
  try {
    console.log("🔍 DEBUG: Fetching user data for ID:", userId);
    
    const res = await fetch('/api/auth/me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: userId })
    });
    
    console.log("🔍 DEBUG: API Response status:", res.status);
    
    const data = await res.json();
    console.log("🔍 DEBUG: User API response data:", data);
    
    if (res.ok && data.id) {
      console.log("✅ DEBUG: User data successfully loaded");
      const user = data;

      const roleElement = document.getElementById("userRole");
      if (roleElement) {
        roleElement.textContent = user.role;
        console.log("✅ DEBUG: User role set to:", user.role);
      }

      if (user.role === "admin") {
        document.getElementById("adminPanel")?.classList.remove("hidden");
        console.log("✅ DEBUG: Admin panel shown");
      } else {
        document.getElementById("salesPanel")?.classList.remove("hidden");
        console.log("✅ DEBUG: Sales panel shown");
      }
      
      console.log("✅ DEBUG: Dashboard fully loaded!");
    } else {
      console.error("❌ DEBUG: API returned error:", data.error);
      window.location.href = "/html/login.html";
    }
  } catch (error) {
    console.error("❌ DEBUG: Error fetching user data:", error);
    window.location.href = "/html/login.html";
  }
}

// Rest of your notification code remains the same
const bell = document.getElementById("notifBtn");
const dropdown = document.getElementById("notifDropdown");
if (dropdown) dropdown.classList.remove("hidden");

function openDropdown() {
  dropdown.classList.add("show");
}

function closeDropdown() {
  dropdown.classList.remove("show");
}

function toggleDropdown() {
  if (dropdown.classList.contains("show")) closeDropdown();
  else {
    openDropdown();
    renderNotifications();
  }
}

if (bell) {
  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });
}

document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target) && e.target !== bell) closeDropdown();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDropdown();
});

async function renderNotifications() {
  try {
    const res = await fetch("/api/notifications");
    const list = await res.json();

    if (dropdown) {
      dropdown.innerHTML =
        Array.isArray(list) && list.length
          ? list
              .map(
                (n) => `
              <div class="notification-item" style="display:flex;gap:8px;align-items:flex-start;padding:6px 2px;border-bottom:1px solid var(--border);">
                <span>🔔</span>
                <div class="notification-message" style="flex:1">${n.message}</div>
                <button class="notification-delete" data-id="${n._id}"
                  style="background:transparent;border:1px solid rgba(239,68,68,.35);border-radius:8px;padding:2px 6px;color:#ef4444">
                  🗑️
                </button>
              </div>
            `,
              )
              .join("")
          : `<p><em>No notifications</em></p>`;
    }
  } catch {
    if (dropdown) dropdown.innerHTML = `<p style="color:#ef4444">⚠️ Failed to load</p>`;
  }
}

if (dropdown) {
  dropdown.addEventListener("click", async (e) => {
    const btn = e.target.closest(".notification-delete");
    if (!btn) return;
    try {
      await fetch(`/api/notifications/${btn.dataset.id}`, { method: "DELETE" });
      renderNotifications();
    } catch {}
  });
}