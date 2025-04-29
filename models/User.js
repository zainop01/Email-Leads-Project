// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  email:          { type: String, required: true, unique: true },
  password:       { type: String, required: true },
  isVerified:     { type: Boolean, default: false },
  verificationToken: String,
  resetToken:     String,
  resetTokenExpire: Date,

  // ── new profile fields ─────────────────────────────
  avatarUrl:      { type: String },         // e.g. s3 link or upload path
  bio:            { type: String },
  company:        { type: String },
  phone:          { type: String },
  settings:       {                           // any UI / notification prefs
    newsletter:   { type: Boolean, default: true },
    darkMode:     { type: Boolean, default: false }
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
