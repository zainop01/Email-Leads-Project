// models/Team.js
const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  owner:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["owner","manager","member"], default: "member" }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("Team", teamSchema);