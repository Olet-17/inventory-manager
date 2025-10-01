const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  _id: Number, // Use numeric IDs instead of ObjectId
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "sales" },
  lastLogin: Date,
  email: String,
  preferences: {
    theme: String,
    language: String,
  },
}, { 
  _id: true // This allows us to manually set _id
});

const User = mongoose.model("User", userSchema);

// Create indexes
User.collection.createIndex({ username: "text", email: "text" }).catch(() => {});

module.exports = User;