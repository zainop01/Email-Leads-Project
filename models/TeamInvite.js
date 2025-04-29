// models/TeamInvite.js
const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  team:     { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
  email:    { type: String, required: true },
  role:     { type: String, enum: ["manager","member"], default: "member" },
  token:    { type: String, required: true },
  status:   { type: String, enum: ["pending","accepted","declined"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("TeamInvite", inviteSchema);