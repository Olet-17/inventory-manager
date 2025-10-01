console.log("✅ login.js is loaded and running");
console.log("🟢 PostgreSQL AUTH ACTIVE");

const form = document.getElementById("loginForm");
if (!form) {
  console.error("❌ loginForm NOT FOUND in DOM!");
} else {
  console.log("✅ loginForm FOUND - Ready for PostgreSQL auth");
}

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("message");

  try {
    // ✅ CHANGED: Now using PostgreSQL auth endpoint
    const res = await fetch("/api/auth-sql/login-sql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    console.log("🔍 PostgreSQL Login response:", data);

    if (res.ok && data.user?.id) {
      // ✅ Save to localStorage
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("userRole", data.user.role);
      localStorage.setItem("username", data.user.username);

      console.log("✅ DEBUG: Saved user data to localStorage:", {
        id: data.user.id,
        role: data.user.role,
        username: data.user.username,
      });

      // Verify storage
      const verifyId = localStorage.getItem("userId");
      console.log("🔍 DEBUG: Verified userId in storage:", verifyId);

      if (verifyId === data.user.id.toString()) {
        console.log("✅ DEBUG: PostgreSQL auth storage verification PASSED");
        msg.textContent = "Login successful! (PostgreSQL)";
        msg.style.color = "green";

        setTimeout(() => {
          console.log("🔍 DEBUG: Redirecting to dashboard...");
          window.location.href = "/html/dashboard.html";
        }, 1000);
      } else {
        console.error("❌ DEBUG: Storage verification FAILED");
        msg.textContent = "Login failed - session error";
        msg.style.color = "red";
      }
    } else {
      msg.textContent = data.error || "Login failed";
      msg.style.color = "red";
    }
  } catch (error) {
    console.error("PostgreSQL Login error:", error);
    msg.textContent = "An unexpected error occurred.";
    msg.style.color = "red";
  }
});
