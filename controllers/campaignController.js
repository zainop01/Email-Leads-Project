const Campaign           = require("../models/Campaign");
const CampaignExecution  = require("../models/CampaignExecution");
const Template           = require("../models/Template");
const { parseCSV } = require("../utils/parseCSV");
const { scheduleJobExec }= require("../workers/campaignDispatcher");
const path              = require("path");
const fs                = require("fs");

// ── CRUD on Campaigns ─────────────────────────────────────

// Create or update still uses existing patterns…
exports.createCampaign = async (req, res) => {
  const { name, description, steps } = req.body;
  if (!name || !Array.isArray(steps) || !steps.length)
    return res.status(400).json({ message: "Name & steps required" });
  const camp = await Campaign.create({
    user: req.user._id, name, description, steps
  });
  res.status(201).json(camp);
};

exports.getCampaigns = async (req, res) => {
  const camps = await Campaign.find({ user: req.user._id });
  res.json(camps);
};

exports.getCampaign  = async (req, res) => {
  const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
  if (!camp) return res.status(404).json({ message: "Not found" });
  res.json(camp);
};

exports.updateCampaign = async (req, res) => {
  const camp = await Campaign.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    req.body, { new: true, runValidators: true }
  );
  if (!camp) return res.status(404).json({ message: "Not found" });
  res.json(camp);
};

exports.deleteCampaign = async (req, res) => {
  const camp = await Campaign.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!camp) return res.status(404).json({ message: "Not found" });
  // optionally also delete pending executions…
  await CampaignExecution.deleteMany({ campaign: camp._id, status: "scheduled" });
  res.json({ message: "Deleted" });
};



// @desc    Start a drip campaign by uploading CSV
// @route   POST /api/campaigns/:id/start
// @access  Private
exports.startCampaign = async (req, res) => {
  try {
    // 1) CSV + recipients
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }
    const csvPath   = path.join(__dirname, "../uploads", req.file.filename);
    const recipients = await parseCSV(csvPath);
    fs.unlink(csvPath, () => {});
    if (!recipients.length) {
      return res.status(400).json({ message: "CSV must contain ≥1 email" });
    }

    // 2) Load campaign
    const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
    if (!camp) return res.status(404).json({ message: "Campaign not found" });

    // 3) Preload templates & validate
    const tplMap = {};
    for (let step of camp.steps) {
      if (step.template) {
        const tpl = await Template.findById(step.template);
        if (!tpl) {
          return res.status(400).json({
            message: `Template ${step.template} not found for step with delay ${step.delayMinutes}`
          });
        }
        tplMap[step._id] = tpl;
      }
    }

    // 4) Mark running & save recipients
    camp.recipients = recipients;
    camp.status     = "running";
    await camp.save();

    // 5) Schedule executions
    const baseTime = Date.now();
    let cumulativeDelay = 0; // in ms

    for (let idx = 0; idx < camp.steps.length; idx++) {
      const step = camp.steps[idx];
      cumulativeDelay += step.delayMinutes * 60_000;
      const sendAt = new Date(baseTime + cumulativeDelay);

      // find content (template overrides manual)
      let serviceName = step.serviceName;
      let subject     = step.subject;
      let senderName  = step.senderName;
      let senderEmail = step.senderEmail;
      let htmlBody    = step.htmlBody;

      if (step.template) {
        const tpl = tplMap[step._id];
        serviceName = tpl.serviceName;
        subject     = tpl.subject;
        senderName  = tpl.senderName;
        senderEmail = tpl.senderEmail;
        htmlBody    = tpl.htmlBody;
      }

      // create & schedule one execution per recipient
      for (let email of recipients) {
        const exec = await CampaignExecution.create({
          campaign:     camp._id,
          stepIndex:    idx,
          contactEmail: email,
          serviceName,
          subject,
          senderName,
          senderEmail,
          htmlBody,
          scheduleAt:   sendAt
        });
        scheduleJobExec(exec);
      }
    }

    res.json({ 
      message: "Campaign started", 
      totalRecipients: recipients.length,
      totalSteps: camp.steps.length 
    });
  } catch (err) {
    console.error("startCampaign error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// @desc  Pause or resume a campaign
exports.pauseCampaign = async (req, res) => {
  const camp = await Campaign.findById(req.params.id);
  if (!camp || !camp.user.equals(req.user._id)) 
    return res.status(404).json({ message: "Not found" });
  camp.status = "paused"; await camp.save();
  // cancel all pending executions
  const pending = await CampaignExecution.find({ campaign: camp._id, status: "scheduled" });
  pending.forEach(e => require("node-schedule").cancelJob(e._id.toString()));
  res.json({ message: "Paused" });
};

exports.resumeCampaign = async (req, res) => {
  const camp = await Campaign.findById(req.params.id);
  if (!camp || !camp.user.equals(req.user._id)) 
    return res.status(404).json({ message: "Not found" });
  camp.status = "running"; await camp.save();
  // re-schedule any executions that are due
  const pend = await CampaignExecution.find({ campaign: camp._id, status: "scheduled" });
  pend.forEach(e => scheduleJobExec(e));
  res.json({ message: "Resumed" });
};

exports.getCampaignExecutions = async (req, res) => {
  try {
    // 1) ensure campaign belongs to this user
    const camp = await Campaign.findOne({ _id: req.params.id, user: req.user._id });
    if (!camp) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // 2) fetch executions, sorted by schedule time
    const executions = await CampaignExecution
      .find({ campaign: camp._id })
      .sort("scheduleAt");

    res.json(executions);
  } catch (err) {
    console.error("getCampaignExecutions error:", err);
    res.status(500).json({ message: "Server error" });
  }
};