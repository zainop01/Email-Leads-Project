// models/Template.js
const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:        { type: String, required: true , unique: true   },
  serviceName: { type: String, required: true },
  subject:     { type: String, required: true },
  senderName:  { type: String, required: true },
  senderEmail: { type: String, required: true },
  htmlBody:    { type: String, required: true },
  csvUrl:      { type: String },               // ← make sure this exists
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date }
});

templateSchema.pre("findOneAndUpdate", function(next) {
  this._update.updatedAt = Date.now();
  next();
});

module.exports =
  mongoose.models.Template ||
  mongoose.model("Template", templateSchema);
