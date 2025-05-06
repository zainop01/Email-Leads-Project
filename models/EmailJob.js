// models/EmailJob.js
const mongoose = require("mongoose");

const emailJobSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // template:     { type: mongoose.Schema.Types.ObjectId, ref: "Template" },  // NEW
  smtpAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: "SmtpAccount" }],
  serviceName: { type: String, required: true },
  subject: { type: String, required: true },
  senderName: { type: String, required: true },
  senderEmail: { type: String, required: true },
  htmlBody: { type: String, required: true },
  bookmarked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  total: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
});

module.exports = mongoose.model("EmailJob", emailJobSchema);