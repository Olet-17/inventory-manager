console.log("✅ login.js is loaded and running");

console.log("🟢 login.js LOADED");

const form = document.getElementById("loginForm");
if (!form) {
  console.error("❌ loginForm NOT FOUND in DOM!");
} else {
  console.log("✅ loginForm FOUND");
}

document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const msg = document.getElementById("message");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      console.log("🔍 Login response:", data);

      if (res.ok && data.user?.id) {
        // ✅ Ruajmë vetëm userId në sessionStorage
        sessionStorage.setItem("userId", data.user.id);
        console.log("✅ Saved userId to sessionStorage:", data.user.id);

        msg.textContent = "Login successful!";
        msg.style.color = "green";

        setTimeout(() => {
          window.location.href = "/html/dashboard.html";
        }, 1000);
      } else {
        msg.textContent = data.error || "Login failed";
        msg.style.color = "red";
      }
    } catch (error) {
      console.error("Login error:", error);
      msg.textContent = "An unexpected error occurred.";
      msg.style.color = "red";
    }
  });
