const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema({
    name:         { type: String },
    delayMinutes: { type: Number, required: true },
  
    // optional template reference
    template:     { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
  
    // manual-entry fallback fields
    subject:      { type: String },
    senderName:   { type: String },
    body:     { type: String },
  
    condition:    { 
      type: String, 
      enum: ["always","noReply","opened","replied"], 
      default: "always" 
    }
  });

const campaignSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:        { type: String, required: true },
  description: { type: String },
  steps:       [stepSchema],
  recipients:  [{ type: String }], 
  status:      { 
    type: String, 
    enum: ["draft","running","paused","completed","cancelled"], 
    default: "draft" 
  },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date }
});

// Auto-set updatedAt
campaignSchema.pre("findOneAndUpdate", function(next) {
  this._update.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Campaign", campaignSchema);
