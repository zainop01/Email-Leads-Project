// controllers/campaignController.js
const path           = require("path");
const fs             = require("fs");
const Campaign       = require("../models/Campaign");
const Execution      = require("../models/CampaignExecution");
const parseCSV       = require("../utils/parseCSV").parseCSV;
const { scheduleInMemory, cancelScheduledJob } = require("../workers/dispatchCampaigns");

// Create a new campaign (draft)
exports.createCampaign = async (req, res) => {
  const { name, description, steps } = req.body;
  if (!name || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ message: "name + steps array are required" });
  }
  const campaign = await Campaign.create({
    user: req.user._id,
    name,
    description,
    steps
  });
  res.status(201).json(campaign);
};

// List campaigns
exports.getCampaigns = async (req, res) => {
  const campaigns = await Campaign.find({ user: req.user._id }).sort("-createdAt");
  res.json(campaigns);
};

// Get one
exports.getCampaign = async (req, res) => {
  const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
  if (!camp) return res.status(404).json({ message: "Not found" });
  res.json(camp);
};

// Update draft
exports.updateCampaign = async (req, res) => {
  const updates = (({ name, description, steps }) => ({ name, description, steps }))(req.body);
  const camp = await Campaign.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: "draft" },
    updates,
    { new: true, runValidators: true }
  );
  if (!camp) return res.status(404).json({ message: "Not found or not draft" });
  res.json(camp);
};

// Delete draft
exports.deleteCampaign = async (req, res) => {
  const camp = await Campaign.findOneAndDelete({ _id: req.params.id, user: req.user._id, status: "draft" });
  if (!camp) return res.status(404).json({ message: "Not found or not draft" });
  res.json({ message: "Deleted" });
};

// Start a draft: upload CSV => parse recipients => create Executions + schedule them
exports.startCampaign = async (req, res) => {
  const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
  if (!camp || camp.status !== "draft") {
    return res.status(400).json({ message: "Campaign not found or not draft" });
  }
  if (!req.file) {
    return res.status(400).json({ message: "CSV file required" });
  }
  // parse CSV
  const filePath = path.join(__dirname, "../uploads", req.file.filename);
  const recipients = await parseCSV(filePath);
  fs.unlink(filePath, () => {});
  if (recipients.length === 0) {
    return res.status(400).json({ message: "No emails found in CSV" });
  }

  camp.recipients = recipients;
  camp.status     = "running";
  await camp.save();

  // For each step & each recipient, create an Execution
  const now = Date.now();
  for (let stepIndex = 0; stepIndex < camp.steps.length; stepIndex++) {
    const step = camp.steps[stepIndex];
    for (let email of recipients) {
      const scheduleAt = new Date(now + step.delayMinutes * 60000);
      const exec = await Execution.create({
        campaign:     camp._id,
        stepIndex,
        contactEmail: email,
        templateUsed: step.template,
        scheduleAt
      });
      scheduleInMemory(exec);
    }
  }

  res.json({ message: "Campaign started", campaign: camp });
};

// Pause: cancel all future executions
exports.pauseCampaign = async (req, res) => {
  const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
  if (!camp || camp.status !== "running") {
    return res.status(400).json({ message: "Not found or not running" });
  }
  // cancel each scheduled exec
  const pending = await Execution.find({ campaign: camp._id, status: "scheduled" });
  pending.forEach(exec => cancelScheduledJob(exec._id.toString()));
  camp.status = "paused";
  await camp.save();
  res.json({ message: "Paused" });
};

// Resume: re-schedule pending executions
exports.resumeCampaign = async (req, res) => {
  const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
  if (!camp || camp.status !== "paused") {
    return res.status(400).json({ message: "Not found or not paused" });
  }
  const pending = await Execution.find({ campaign: camp._id, status: "scheduled" });
  pending.forEach(exec => scheduleInMemory(exec));
  camp.status = "running";
  await camp.save();
  res.json({ message: "Resumed" });
};

// Cancel: cancel + mark skipped
exports.cancelCampaign = async (req, res) => {
  const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
  if (!camp || !["running","paused"].includes(camp.status)) {
    return res.status(400).json({ message: "Not found or cannot cancel" });
  }
  const pending = await Execution.find({ campaign: camp._id, status: "scheduled" });
  await Promise.all(pending.map(async exec => {
    cancelScheduledJob(exec._id.toString());
    exec.status = "skipped";
    await exec.save();
  }));
  camp.status = "cancelled";
  await camp.save();
  res.json({ message: "Cancelled" });
};


