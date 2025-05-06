// models/EmailRecord.js
const mongoose = require("mongoose");

const emailRecordSchema = new mongoose.Schema({
  job:          { type: mongoose.Schema.Types.ObjectId, ref: "EmailJob", required: true },
  email:        { type: String, required: true },
  status:       { type: String, enum: ["sent","failed" , "opened"], required: true },
  error:        { type: String },
  openedAt:     { type: Date },
  sentAt:     { type: Date },
  // smtpAccount: { type: mongoose.Schema.Types.ObjectId, ref: "SmtpAccount", required: true },
}, { timestamps: true });

module.exports = mongoose.model("EmailRecord", emailRecordSchema);
  