const mongoose = require("mongoose");

const scheduledJobSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  campaign:     { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
  smtpAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: "SmtpAccount" }],
  // same fields you already use
  template:     { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
  serviceName:  { type: String, required: true },
  subject:      { type: String, required: true },
  senderName:   { type: String, required: true },
  senderEmail:  { type: String, required: true },
  htmlBody:     { type: String, required: true },

  // parsed recipients
  recipients:   [{ type: mongoose.Schema.Types.Mixed, required: true }], 

  // when to send
  scheduleAt:   { type: Date, required: true },

  // lifecycle
  status:       { type: String, enum: ["scheduled","processing","completed","failed"], default: "scheduled" },
  total:        { type: Number, default: 0 },
  sentCount:    { type: Number, default: 0 },
  failedCount:  { type: Number, default: 0 },

  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model("ScheduledJob", scheduledJobSchema);
