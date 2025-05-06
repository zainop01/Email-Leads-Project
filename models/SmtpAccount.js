// models/SmtpAccount.js
const mongoose = require("mongoose");

const smtpAccountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true }, // e.g. "Gmail-Marketing" or "Office365-Sales"
  host: { type: String, required: true },
  port: { type: Number, required: true },
  secure: { type: Boolean, default: false },
  authUser: { type: String, required: true },
  authPass: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
});

smtpAccountSchema.index(
    { user: 1, authUser: 1, host: 1, port: 1 },
    { unique: true }
  );

module.exports = mongoose.model("SmtpAccount", smtpAccountSchema);
