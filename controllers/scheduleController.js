const path = require("path");
const fs = require("fs");
const {parseCSV} = require("../utils/parseCSV");
const ScheduledJob = require("../models/ScheduledJob");
const Template     = require("../models/Template");
const { scheduleInMemory } = require("../workers/dispatchScheduledJobs");
const scheduleLib      = require("node-schedule");
const { default: mongoose } = require("mongoose");

// @desc    Schedule a one-time bulk send
// @route   POST /api/schedule
// @access  Private
exports.scheduleBulkEmail = async (req, res) => {
  try {
    // ── 1) Parse smtpAccountIds ──
    let rawIds = req.body.smtpAccountIds;
    let smtpAccountIds = [];
    if (Array.isArray(rawIds)) smtpAccountIds = rawIds;
    else if (typeof rawIds === "string") {
      try { smtpAccountIds = JSON.parse(rawIds); }
      catch { smtpAccountIds = rawIds.split(",").map(s => s.trim()); }
    }
    smtpAccountIds = smtpAccountIds.filter(id => mongoose.Types.ObjectId.isValid(id));

    const { serviceName, subject, senderName, senderEmail, htmlBody } = req.body;
    if (!serviceName || !senderName || !senderEmail || !subject || !htmlBody) {
      return res.status(400).json({
        message: "serviceName, senderName, senderEmail, subject and htmlBody are all required"
      });
    }

    // ── 2) Validate scheduleAt & template override ──
    const { scheduleAt, templateId } = req.body;
    if (!scheduleAt) return res.status(400).json({ message: "scheduleAt is required" });
    const sendDate = new Date(scheduleAt);
    if (isNaN(sendDate) || sendDate <= Date.now())
      return res.status(400).json({ message: "`scheduleAt` must be a valid future date/time" });

    // override via template if provided...
    // (same as your code, setting _serviceName, _subject, etc.)

    // ── 3) Require & parse CSV ──
    if (!req.file) return res.status(400).json({ message: "CSV file required" });
    const filePath   = path.join(__dirname, "../uploads", req.file.filename);
    const recipients = await parseCSV(filePath);
    fs.unlink(filePath, () => {});

    // ── 4) Create the ScheduledJob with SMTP accounts & all the templating fields ──
    const job = await ScheduledJob.create({
      user:          req.user._id,
      template:      templateId,
      smtpAccounts:  smtpAccountIds,       // ← carry over
      serviceName,
      subject,
      senderName,
      senderEmail,
      htmlBody,
      recipients,
      scheduleAt:    sendDate,
      total:         recipients.length
    });

    // ── 5) Schedule in‐memory for dispatch ──
    scheduleInMemory(job);

    return res.status(201).json({ message: "Job scheduled", job });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};


// @desc    List scheduled jobs
// @route   GET /api/schedule
// @access  Private
exports.getScheduledJobs = async (req, res) => {
  const jobs = await ScheduledJob.find({ user: req.user._id }).sort("-scheduleAt");
  res.json(jobs);
};

// @desc    Update a scheduled job (e.g. reschedule or cancel fields)
// @route   PUT /api/schedule/:id
// @access  Private
exports.updateScheduledJob = async (req, res) => {
  try {
    // 1) Must supply new scheduleAt
    const { scheduleAt } = req.body;
    if (!scheduleAt) {
      return res.status(400).json({ message: "`scheduleAt` is required" });
    }

    // 2) Validate new date
    const newDate = new Date(scheduleAt);
    if (isNaN(newDate) || newDate <= new Date()) {
      return res
        .status(400)
        .json({ message: "`scheduleAt` must be a valid future date/time" });
    }

    // 3) Fetch the job
    const job = await ScheduledJob.findOne({ _id: req.params.id, user: req.user._id });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // 4) Only allow if still scheduled
    if (job.status !== "scheduled") {
      return res
        .status(400)
        .json({ message: `Cannot reschedule a job that is ${job.status}` });
    }

    // 5) Cancel the old in-memory schedule
    scheduleLib.cancelJob(job._id.toString());

    // 6) Update and save
    job.scheduleAt = newDate;
    await job.save();

    // 7) Re-schedule in-memory
    scheduleInMemory(job);

    res.json({ message: "Scheduled job rescheduled", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}
// @desc    Cancel (delete) a scheduled job
// @route   DELETE /api/schedule/:id
// @access  Private
exports.deleteScheduledJob = async (req, res) => {
  try {
    const job = await ScheduledJob.findOne({ _id: req.params.id, user: req.user._id });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Only allow delete if job is still scheduled
    if (job.status !== "scheduled") {
      return res
        .status(400)
        .json({ message: `Cannot delete a job that is ${job.status}` });
    }

    // Cancel the in-memory scheduled job
    scheduleLib.cancelJob(job._id.toString());

    await job.deleteOne();

    res.json({ message: "Scheduled job cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};