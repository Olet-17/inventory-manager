console.log("✅ signup.js loaded");
console.log("🟢 Session-based signup + auto-login");

const form = document.getElementById("signupForm");
const msg = document.getElementById("message");

const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const roleEl = document.getElementById("role");
const emailEl = document.getElementById("email"); // optional if present

function showMsg(text, kind = "error") {
  if (!msg) return;
  msg.textContent = text || "";
  msg.classList.remove("error", "success");
  msg.classList.add(kind);
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
  const role = roleEl?.value || "sales";
  const email = emailEl?.value?.trim() || undefined;

  if (!username || !password) {
    showMsg("Username and password are required.", "error");
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    // 1) Register (PostgreSQL)
    const regResp = await fetch("/api/auth-sql/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No credentials needed for register unless your server requires it
      body: JSON.stringify({ username, password, role, email }),
    });
    const regData = await safeJson(regResp);

    if (!regResp.ok) {
      showMsg(regData?.error || "Signup failed.", "error");
      return;
    }

    showMsg("Signup successful! Logging you in…", "success");

    // 2) Auto-login to create session cookie
    const loginResp = await fetch("/api/auth-sql/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // <-- set httpOnly session cookie
      body: JSON.stringify({ username, password }),
    });
    const loginData = await safeJson(loginResp);

    if (!loginResp.ok || !loginData?.success) {
      // Fallback: go to login screen if auto-login fails
      showMsg("Account created. Please sign in.", "success");
      setTimeout(() => (window.location.href = "login.html"), 800);
      return;
    }

    // 3) Verify session and redirect by role
    const meResp = await fetch("/api/auth-sql/me", { credentials: "include" });
    const meData = await safeJson(meResp);

    if (!meResp.ok || !meData?.user) {
      showMsg("Signed up, but session check failed. Please sign in.", "error");
      setTimeout(() => (window.location.href = "login.html"), 900);
      return;
    }

    const roleLower = String(meData.user.role || "").toLowerCase();
    setTimeout(() => {
      window.location.href = roleLower === "admin" ? "/html/products.html" : "/html/sales.html";
    }, 500);
  } catch (err) {
    console.error("Signup error:", err);
    showMsg("An unexpected error occurred.", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

// ===== Password strength meter (unchanged, kept from your code) =====
const signupPass = document.getElementById("password");
const signupBar = document.getElementById("signup-strength-bar");
const signupText = document.getElementById("signup-strength-text");

signupPass?.addEventListener("input", () => {
  updateStrengthMeter(signupPass.value, signupBar, signupText);
});

function updateStrengthMeter(val, bar, text) {
  if (!bar || !text) return;
  let strength = 0;
  if (val.length >= 8) strength++;
  if (/[A-Z]/.test(val)) strength++;
  if (/[0-9]/.test(val)) strength++;
  if (/[^A-Za-z0-9]/.test(val)) strength++;

  const colors = ["#ff4d4d", "#ff884d", "#ffdb4d", "#4dff88"];
  const labels = ["Weak", "Okay", "Good", "Strong"];

  bar.style.width = strength * 25 + "%";
  bar.style.background = colors[strength - 1] || "transparent";
  text.textContent = labels[strength - 1] || "";
}

console.log("✅ PostgreSQL Signup ready!");
