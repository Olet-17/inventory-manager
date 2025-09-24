document.addEventListener("DOMContentLoaded", async () => {
  const userId = sessionStorage.getItem("userId");
  const msg = document.getElementById("profileMessage");
  const form = document.getElementById("profileForm");

  if (!userId) {
    window.location.href = "/html/login.html";
    return;
  }

  try {
    const res = await fetch(`/api/user/${userId}`);
    const data = await res.json();

    if (!res.ok || !data.user) {
      throw new Error("User not found");
    }

    const user = data.user;

    // Set form values
    document.getElementById("username").value = user.username || "";
    document.getElementById("email").value = user.email || "";
    document.getElementById("language").value =
      user.preferences?.language || "en";
    document.getElementById("theme").value = user.preferences?.theme || "light";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const updatedEmail = document.getElementById("email").value.trim();
      const updatedTheme = document.getElementById("theme").value;
      const updatedLang = document.getElementById("language").value;

      const updateRes = await fetch(`/api/user/${userId}`, {
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
        msg.textContent = "❌ Failed to update profile.";
        msg.style.color = "red";
      }
    });
  } catch (err) {
    console.error("Profile load error:", err);
    msg.textContent = "❌ Could not load profile data.";
    msg.style.color = "red";
  }
});

document
  .getElementById("passwordForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = document.getElementById("currentPassword").value;
    const next = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    const message = document.getElementById("passwordMessage");
    const userId = sessionStorage.getItem("userId");

    if (next !== confirm) {
      message.textContent = "❌ Passwords do not match.";
      message.style.color = "red";
      return;
    }

    const res = await fetch(`/api/user/${userId}/password`, {
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
  });
