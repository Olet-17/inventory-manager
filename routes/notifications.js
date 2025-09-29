const express = require("express");
const Notification = require("../models/Notification");
const router = express.Router();

// Get notifications
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(10);
    res.json(notifications);
  } catch (err) {
    console.error("❌ Failed to fetch notifications:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

// Delete notification
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Error deleting notification:", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

module.exports = router;
