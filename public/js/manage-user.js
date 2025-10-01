document.addEventListener("DOMContentLoaded", async () => {
  // ✅ FIXED: Check authentication using userId from localStorage
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "/html/login.html";
    return;
  }

  try {
    // ✅ CHANGED: Use PostgreSQL auth endpoint
    const userRes = await fetch("/api/auth-sql/user-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId }),
    });

    const userData = await userRes.json();

    // ✅ CHANGED: Check userData.user.role (PostgreSQL format)
    if (!userData.user || userData.user.role !== "admin") {
      document.getElementById("notAllowed").style.display = "block";
      return;
    }

    const table = document.getElementById("userTable");
    const tbody = table.querySelector("tbody");

    // ✅ CHANGED: Use PostgreSQL users endpoint
    const res = await fetch("/api/auth-sql/users-sql");
    const data = await res.json();
    const users = data.users; // PostgreSQL returns { users: [...] }

    table.style.display = "table";

    users.forEach((u) => {
      const row = document.createElement("tr");

      // ✅ CHANGED: Use PostgreSQL field names (id instead of _id)
      row.innerHTML = `
        <td>${u.username}</td>
        <td>${u.email || "-"}</td>
        <td>${u.role}</td>
        <td>
          <button onclick="toggleRole('${u.id}', '${u.role}')">🔁 Role</button>
          <button onclick="deleteUser('${u.id}')">🗑️ Delete</button>
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

  // ✅ CHANGED: Use PostgreSQL role update endpoint
  const res = await fetch(`/api/auth-sql/users/${id}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: newRole }),
  });

  if (res.ok) location.reload();
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  // ✅ CHANGED: Use PostgreSQL delete endpoint
  const res = await fetch(`/api/auth-sql/users/${id}`, {
    method: "DELETE",
  });

  if (res.ok) location.reload();
}

console.log("✅ PostgreSQL Manage Users ready!");
