document.getElementById("signupForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  try {
    // ✅ CHANGED: Now using PostgreSQL registration endpoint
    const res = await fetch("/api/auth-sql/register-sql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, role }),
    });

    const data = await res.json();
    const msg = document.getElementById("message");

    if (res.ok) {
      msg.textContent = "Signup successful! (PostgreSQL)";
      msg.style.color = "green";
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);
    } else {
      msg.textContent = data.error || "Signup failed";
      msg.style.color = "red";
    }
  } catch (err) {
    console.error("PostgreSQL Signup error:", err);
    const msg = document.getElementById("message");
    msg.textContent = "An unexpected error occurred.";
    msg.style.color = "red";
  }
});

const signupPass = document.getElementById("password");
const signupBar = document.getElementById("signup-strength-bar");
const signupText = document.getElementById("signup-strength-text");

signupPass.addEventListener("input", () => {
  updateStrengthMeter(signupPass.value, signupBar, signupText);
});

function updateStrengthMeter(val, bar, text) {
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
