const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  message: String,
  type: { type: String, default: "info" },
  createdAt: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false },
});

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
