console.log("✅ login.js is loaded and running");
console.log("🟢 Session-based AUTH ACTIVE");

const form = document.getElementById("loginForm");
const msg = document.getElementById("message");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");

if (!form) {
  console.error("❌ loginForm NOT FOUND in DOM!");
}

function showMsg(text, kind = "error") {
  if (!msg) return;
  msg.textContent = text || "";
  msg.classList.remove("error", "success");
  msg.classList.add(kind);
  // fallback colors if no CSS classes defined
  if (!msg.classList.contains("error") && !msg.classList.contains("success")) {
    msg.style.color = kind === "success" ? "#22c55e" : "#ef4444";
  }
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = usernameEl?.value.trim();
  const password = passwordEl?.value || "";

  if (!username || !password) {
    showMsg("Please enter username and password.", "error");
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    // 1) Login -> sets httpOnly session cookie
    const loginResp = await fetch("/api/auth-sql/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // <-- IMPORTANT: send/receive cookie
      body: JSON.stringify({ username, password }),
    });
    const loginData = await safeJson(loginResp);

    if (!loginResp.ok || !loginData?.success) {
      showMsg(loginData?.error || "Login failed.", "error");
      return;
    }

    // 2) Verify session and get role
    const meResp = await fetch("/api/auth-sql/me", { credentials: "include" });
    const meData = await safeJson(meResp);

    if (!meResp.ok || !meData?.user) {
      showMsg("Session error after login. Please try again.", "error");
      return;
    }

    const role = String(meData.user.role || "").toLowerCase();

    showMsg("Login successful!", "success");

    // 3) Redirect by role (tweak to your preference)
    setTimeout(() => {
      if (role === "admin") {
        window.location.href = "/html/dashboard.html";
      } else {
        window.location.href = "/html/sales.html";
      }
    }, 400);
  } catch (err) {
    console.error("Login error:", err);
    showMsg("Unexpected error. Please try again.", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});
