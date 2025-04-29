const mongoose = require("mongoose");

const executionSchema = new mongoose.Schema({
  campaign:     { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
  stepIndex:    { type: Number, required: true },
  contactEmail: { type: String, required: true },
  templateUsed: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
  
  // scheduling & send
  scheduleAt:   { type: Date, required: true },
  sentAt:       { type: Date },
  status:       { type: String, enum: ["scheduled","processing","sent","failed","skipped"], default: "scheduled" },
  error:        { type: String },
}, { timestamps: true });

module.exports = mongoose.model("CampaignExecution", executionSchema);
