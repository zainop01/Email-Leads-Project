const mongoose = require("mongoose");

const emailRecordSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: "EmailJob", required: true },
  email: { type: String, required: true },
  status: { type: String, enum: ["sent", "failed"], required: true },
  error: { type: String }
});

module.exports = mongoose.model("EmailRecord", emailRecordSchema);