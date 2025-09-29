console.log("✅ login.js is loaded and running");

console.log("🟢 login.js LOADED");

const form = document.getElementById("loginForm");
if (!form) {
  console.error("❌ loginForm NOT FOUND in DOM!");
} else {
  console.log("✅ loginForm FOUND");
}

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("message");

 try {
  // ✅ FIXED: Changed from /api/login to /api/auth/login
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  console.log("🔍 Login response:", data);

  if (res.ok && data.user?.id) {
    // ✅ CHANGE: Use localStorage instead of sessionStorage
    localStorage.setItem("userId", data.user.id);
    console.log("✅ DEBUG: Saved userId to localStorage:", data.user.id);
    
    // VERIFY it was saved immediately
    const verifyId = localStorage.getItem("userId");
    console.log("🔍 DEBUG: Verified userId in storage:", verifyId);
    
    if (verifyId === data.user.id) {
      console.log("✅ DEBUG: Storage verification PASSED");
      msg.textContent = "Login successful!";
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
  console.error("Login error:", error);
  msg.textContent = "An unexpected error occurred.";
  msg.style.color = "red";
}});