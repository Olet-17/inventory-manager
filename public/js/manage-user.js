document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user || user.role !== "admin") {
    document.getElementById("notAllowed").style.display = "block";
    return;
  }

  const table = document.getElementById("userTable");
  const tbody = table.querySelector("tbody");

  try {
    const res = await fetch("/api/users");
    const users = await res.json();

    table.style.display = "table";

    users.forEach(u => {
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
  }
});

async function toggleRole(id, currentRole) {
  const newRole = currentRole === "admin" ? "sales" : "admin";
  const res = await fetch(`/api/users/${id}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: newRole })
  });

  if (res.ok) location.reload();
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  const res = await fetch(`/api/users/${id}`, {
    method: "DELETE"
  });

  if (res.ok) location.reload();
}

