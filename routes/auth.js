const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email,
        preferences: user.preferences,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Try again." });
  }
});

// Register
router.post("/register", async (req, res) => {
  let { username, password, role, email, preferences } = req.body;

  username = username?.trim();
  role = role?.trim();
  email = email?.trim();

  if (!username || !password || !role) {
    return res.status(400).json({ error: "Username, password, and role are required" });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashedPassword,
      role,
      email,
      preferences,
      lastLogin: new Date(),
    });

    await newUser.save();

    if (process.env.NODE_ENV !== "production") {
      console.log(`User registered: ${username} (${role})`);
    }

    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Get current user
router.post("/me", async (req, res) => {
  const { id } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      preferences: user.preferences,
      lastLogin: user.lastLogin,
    });
  } catch (err) {
    console.error("Error in /api/me:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
