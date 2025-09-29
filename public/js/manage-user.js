document.addEventListener("DOMContentLoaded", async () => {
  // ✅ FIXED: Check authentication using userId from localStorage
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "/html/login.html";
    return;
  }

  try {
    // ✅ FIXED: Fetch user data using the new auth endpoint
    const userRes = await fetch('/api/auth/me', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ id: userId })
    });
    
    const userData = await userRes.json();
    
    if (!userData || userData.role !== "admin") {
      document.getElementById("notAllowed").style.display = "block";
      return;
    }

    const table = document.getElementById("userTable");
    const tbody = table.querySelector("tbody");

    const res = await fetch("/api/users");
    const users = await res.json();

    table.style.display = "table";

    users.forEach((u) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${u.username}</td>
        <td>${u.email || "-"}</td>
        <td>${u.role}</td>
        <td>
          <button onclick="toggleRole('${u._id}', '${u.role}')">🔁 Role</button>
          <button onclick="deleteUser('${u._id}')">🗑️ Delete</button>
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Load error:", err);
    document.getElementById("notAllowed").style.display = "block";
  }
});

async function toggleRole(id, currentRole) {
  const newRole = currentRole === "admin" ? "sales" : "admin";
  const res = await fetch(`/api/users/${id}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: newRole }),
  });

  if (res.ok) location.reload();
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  const res = await fetch(`/api/users/${id}`, {
    method: "DELETE",
  });

  if (res.ok) location.reload();
}