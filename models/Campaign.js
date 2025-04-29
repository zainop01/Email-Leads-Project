const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  template: { type: mongoose.Schema.Types.ObjectId, ref: "Template", required: true },
  weight:   { type: Number, default: 1 }  // for A/B splitting
});

const stepSchema = new mongoose.Schema({
    name:         { type: String },
    delayMinutes: { type: Number, required: true },
  
    // optional template reference
    template:     { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
  
    // manual-entry fallback fields
    serviceName:  { type: String },
    subject:      { type: String },
    senderName:   { type: String },
    senderEmail:  { type: String },
    htmlBody:     { type: String },
  
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
  recipients:  [{ type: String }],     // emails list
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
