const express = require("express");
const bcrypt = require("bcryptjs");
const { sqlPool } = require("../db/sql");
const router = express.Router();

// PostgreSQL User Registration
router.post("/register-sql", async (req, res) => {
  try {
    const { username, password, role = "sales", email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert into PostgreSQL
    const result = await sqlPool.query(
      `INSERT INTO users (username, password_hash, role, email) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, role, email, created_at`,
      [username, password_hash, role, email],
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: "User registered successfully (PostgreSQL)",
      user: newUser,
    });
  } catch (error) {
    console.error("PostgreSQL registration error:", error);

    if (error.code === "23505") {
      // Unique violation
      return res.status(400).json({ error: "Username already exists" });
    }

    res.status(500).json({ error: "Registration failed" });
  }
});

// PostgreSQL User Login
router.post("/login-sql", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Find user in PostgreSQL
    const result = await sqlPool.query(
      `SELECT id, username, password_hash, role, email, is_active 
       FROM users WHERE username = $1`,
      [username],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: "Account deactivated" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await sqlPool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);

    // Return user info (without password)
    res.json({
      message: "Login successful (PostgreSQL)",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("PostgreSQL login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get all users (PostgreSQL)
router.get("/users-sql", async (req, res) => {
  try {
    const result = await sqlPool.query(`
      SELECT id, username, role, email, is_active, last_login, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({ users: result.rows });
  } catch (error) {
    console.error("PostgreSQL get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
// Get user info by ID
router.post("/user-info", async (req, res) => {
  try {
    const { userId } = req.body;

    const result = await sqlPool.query(
      "SELECT id, username, role, email, is_active FROM users WHERE id = $1",
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: "Account deactivated" });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("User info error:", error);
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

// Update user role
router.put("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const result = await sqlPool.query(
      "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role",
      [role, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User role updated",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Role update error:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sqlPool.query("DELETE FROM users WHERE id = $1 RETURNING id, username", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User deleted successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});
module.exports = router;
