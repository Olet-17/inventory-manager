document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  const msg = document.getElementById("message");

  if (res.ok) {
    localStorage.setItem("loggedInUser", JSON.stringify(data.user));
    msg.textContent = "Login successful!";
    msg.style.color = "green";
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);
  } else {
    msg.textContent = data.error || "Login failed";
    msg.style.color = "red";
  }
});
