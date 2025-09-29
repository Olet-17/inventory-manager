const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();

// Get all users (admin)
router.get("/", async (req, res) => {
  const users = await User.find({}, "-password");
  res.json(users);
});

// Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("❌ Error fetching user by ID:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update user role
router.put("/:id/role", async (req, res) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  res.json(user);
});

// Update user profile
router.put("/:id", async (req, res) => {
  const { email, preferences } = req.body;

  try {
    const user = await User.findByIdAndUpdate(req.params.id, { email, preferences }, { new: true });
    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error("❌ Failed to update user:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Update user password
router.put("/:id/password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect current password" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ Error updating password:", err);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// Delete user
router.delete("/:id", async (req, res) => {
  const deleted = await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted", user: deleted });
});

module.exports = router;