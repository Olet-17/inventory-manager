const express = require("express");
const bcrypt = require("bcryptjs");
const { sqlPool } = require("../db/sql"); // Import PostgreSQL connection
const router = express.Router();

// Remove MongoDB User import since we're using PostgreSQL
// const User = require("../models/User"); // DELETE THIS LINE

// Login - PostgreSQL
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user in PostgreSQL
    const result = await sqlPool.query("SELECT * FROM users WHERE username = $1", [username]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // Update last login
    await sqlPool.query("UPDATE users SET last_login = $1 WHERE id = $2", [new Date(), user.id]);

    res.json({
      success: true,
      message: "Login successful",
      userId: user.id, // PostgreSQL numeric ID
      username: user.username,
      role: user.role,
      email: user.email,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Try again." });
  }
});

// Get current user - PostgreSQL
router.post("/me", async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "User ID required" });
  }

  try {
    console.log("Looking for user in PostgreSQL with ID:", id);

    // Find user in PostgreSQL
    const result = await sqlPool.query(
      "SELECT id, username, role, email, last_login FROM users WHERE id = $1",
      [id],
    );

    if (result.rows.length === 0) {
      console.log("User not found in PostgreSQL with ID:", id);
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    console.log("Found user in PostgreSQL:", user.username);

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      lastLogin: user.last_login,
    });
  } catch (err) {
    console.error("Error in /api/me:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Register - PostgreSQL
router.post("/register", async (req, res) => {
  let { username, password, role, email } = req.body;

  username = username?.trim();
  role = role?.trim();
  email = email?.trim();

  if (!username || !password || !role) {
    return res.status(400).json({ error: "Username, password, and role are required" });
  }

  try {
    // Check if user exists in PostgreSQL
    const existingResult = await sqlPool.query("SELECT id FROM users WHERE username = $1", [
      username,
    ]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Get next ID
    const maxIdResult = await sqlPool.query("SELECT MAX(id) as max_id FROM users");
    const nextId = (maxIdResult.rows[0].max_id || 0) + 1;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into PostgreSQL
    await sqlPool.query(
      `INSERT INTO users (id, username, password_hash, role, email, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nextId, username, hashedPassword, role, email, new Date()],
    );

    console.log(`User registered in PostgreSQL: ${username} (${role}) with ID: ${nextId}`);

    res.status(201).json({
      message: "User registered successfully!",
      userId: nextId,
    });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Get all users (admin only) - PostgreSQL
router.get("/users", async (req, res) => {
  try {
    const result = await sqlPool.query(
      "SELECT id, username, role, email, created_at, last_login FROM users ORDER BY id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

module.exports = router;
