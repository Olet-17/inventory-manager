document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId");
  const msg = document.getElementById("profileMessage");
  const form = document.getElementById("profileForm");

  if (!userId) {
    window.location.href = "/html/login.html";
    return;
  }

  try {
    // ✅ FIXED: Use auth/me endpoint instead of /api/users/:id
    const res = await fetch("/api/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId }),
    });

    if (!res.ok) {
      throw new Error("User not found");
    }

    const user = await res.json(); // Direct user object, not data.user

    // Set form values
    document.getElementById("username").value = user.username || "";
    document.getElementById("email").value = user.email || "";
    document.getElementById("language").value = user.preferences?.language || "en";
    document.getElementById("theme").value = user.preferences?.theme || "light";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const updatedEmail = document.getElementById("email").value.trim();
      const updatedTheme = document.getElementById("theme").value;
      const updatedLang = document.getElementById("language").value;

      // ✅ FIXED: Use the correct update endpoint for PostgreSQL
      const updateRes = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: updatedEmail,
          preferences: {
            theme: updatedTheme,
            language: updatedLang,
          },
        }),
      });

      if (updateRes.ok) {
        msg.textContent = "✅ Profile updated successfully!";
        msg.style.color = "green";
      } else {
        const errorData = await updateRes.json();
        msg.textContent = `❌ ${errorData.error || "Failed to update profile."}`;
        msg.style.color = "red";
      }
    });
  } catch (err) {
    console.error("Profile load error:", err);
    msg.textContent = "❌ Could not load profile data.";
    msg.style.color = "red";
  }
});

document.getElementById("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const current = document.getElementById("currentPassword").value;
  const next = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;
  const message = document.getElementById("passwordMessage");

  const userId = localStorage.getItem("userId");

  if (!userId) {
    message.textContent = "❌ Please log in again.";
    message.style.color = "red";
    window.location.href = "/html/login.html";
    return;
  }

  if (next !== confirm) {
    message.textContent = "❌ Passwords do not match.";
    message.style.color = "red";
    return;
  }

  try {
    // ✅ FIXED: Use the correct password update endpoint
    const res = await fetch(`/api/users/${userId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });

    const data = await res.json();
    if (res.ok) {
      message.textContent = "✅ Password updated!";
      message.style.color = "green";
      e.target.reset();
    } else {
      message.textContent = data.error || "❌ Failed to update password.";
      message.style.color = "red";
    }
  } catch (error) {
    console.error("Password update error:", error);
    message.textContent = "❌ Server error during password update.";
    message.style.color = "red";
  }
});
