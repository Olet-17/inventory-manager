document.getElementById("signupForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  const res = await fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password, role })
  });

  const data = await res.json();
  const msg = document.getElementById("message");

  if (res.ok) {
    msg.textContent = "Signup successful!";
    msg.style.color = "green";
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
  } else {
    msg.textContent = data.error || "Signup failed";
    msg.style.color = "red";
  }
});
