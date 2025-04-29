const path       = require("path");
const fs         = require("fs");
const nodemailer = require("nodemailer");
const Template   = require("../models/Template");
const EmailJob   = require("../models/EmailJob");
const EmailRecord= require("../models/EmailRecord");
const { parseCSVUrl } = require("../utils/parseCSV");

// @desc    Create a new template
// @route   POST /api/templates
// @access  Private

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: "zainop001@gmail.com",
        pass: "inahbuqfbbxfwvpd",
      },
    });


exports.createTemplate = async (req, res) => {
  console.log("📄  UPLOADED FILE OBJECT:", req.file);
    const {
      name,
      serviceName,
      subject,
      senderName,
      senderEmail,
      htmlBody
    } = req.body;
  
    if (!name || !serviceName || !subject || !senderName || !senderEmail || !htmlBody) {
      return res.status(400).json({ message: "All fields are required" });
    }
  
    const tplData = {
      user:        req.user._id,
      name,
      serviceName,
      subject,
      senderName,
      senderEmail,
      htmlBody
    };
  
    // if Multer+Cloudinary ran, req.file.path is the secure URL
    if (req.file && req.file.path) tplData.csvUrl = req.file.path;
  
    const tpl = await Template.create(tplData);
    res.status(201).json(tpl);
  };

// @desc    List all templates for user
// @route   GET /api/templates
// @access  Private
exports.getTemplates = async (req, res) => {
  const templates = await Template.find({ user: req.user._id }).sort("-createdAt");
  res.json(templates);
};

// @desc    Get single template
// @route   GET /api/templates/:id
// @access  Private
exports.getTemplate = async (req, res) => {
  const tpl = await Template.findOne({ _id: req.params.id, user: req.user._id });
  if (!tpl) return res.status(404).json({ message: "Template not found" });
  res.json(tpl);
};

// @desc    Update a template
// @route   PUT /api/templates/:id
// @access  Private
exports.updateTemplate = async (req, res) => {
    const updates = (({ name, serviceName, subject, senderName, senderEmail, htmlBody }) => 
      ({ name, serviceName, subject, senderName, senderEmail, htmlBody }))(req.body);
  
    // if there's a new CSV, Cloudinary will auto-version it; just overwrite url
    if (req.file && req.file.path) {
      updates.csvUrl = req.file.path;
    }
  
    const tpl = await Template.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    );
    if (!tpl) return res.status(404).json({ message: "Template not found" });
  
    res.json(tpl);
  };

// @desc    Delete a template
// @route   DELETE /api/templates/:id
// @access  Private
exports.deleteTemplate = async (req, res) => {
    const tpl = await Template.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    // if (tpl.csvPath) fs.unlinkSync(tpl.csvPath);
    res.json({ message: "Template deleted" });
  };


  exports.sendByTemplate = async (req, res) => {
    try {
      const tpl = await Template.findOne({ _id: req.params.id, user: req.user._id });
      if (!tpl) return res.status(404).json({ message: "Template not found" });
      if (!tpl.csvUrl) return res.status(400).json({ message: "No CSV attached to this template" });
  
      // 1) Fetch & parse the CSV from Cloudinary
      const recipients = await parseCSVUrl(tpl.csvUrl);
  
      // 2) Create EmailJob
      const job = await EmailJob.create({
        user:        req.user._id,
        template:    tpl._id,
        serviceName: tpl.serviceName,
        senderName:  tpl.senderName,
        senderEmail: tpl.senderEmail,
        subject:     tpl.subject,
        htmlBody:    tpl.htmlBody,
        total:       recipients.length
      });
  
      // 3) Blast
      await Promise.all(recipients.map(async email => {
        try {
          await transporter.sendMail({
            from: `"${tpl.senderName}" <${tpl.senderEmail}>`,
            to:   email,
            subject: tpl.subject,
            html: tpl.htmlBody
          });
          await EmailRecord.create({ job: job._id, email, status: "sent" });
          job.sentCount++;
        } catch (err) {
          await EmailRecord.create({ job: job._id, email, status: "failed", error: err.message });
          job.failedCount++;
        }
      }));
      await job.save();
  
      res.json({ message: "Template emails sent", job });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  };


  exports.scheduleByTemplate = async (req, res) => {
    try {
      const { scheduleAt } = req.body;
      const tpl = await Template.findOne({ _id: req.params.id, user: req.user._id });
      if (!tpl) return res.status(404).json({ message: "Template not found" });
      if (!tpl.csvUrl) return res.status(400).json({ message: "No CSV attached to this template" });
  
      const sendDate = new Date(scheduleAt);
      if (isNaN(sendDate) || sendDate <= new Date()) {
        return res.status(400).json({ message: "`scheduleAt` must be a future date" });
      }
  
      // 1) Fetch & parse the CSV from Cloudinary
      const recipients = await parseCSVUrl(tpl.csvUrl);
  
      // 2) Create ScheduledJob
      const ScheduledJob = require("../models/ScheduledJob");
      const job = await ScheduledJob.create({
        user:        req.user._id,
        template:    tpl._id,
        serviceName: tpl.serviceName,
        senderName:  tpl.senderName,
        senderEmail: tpl.senderEmail,
        subject:     tpl.subject,
        htmlBody:    tpl.htmlBody,
        recipients,
        scheduleAt:  sendDate,
        total:       recipients.length
      });
  
      // 3) In-memory queue
      const { scheduleInMemory } = require("../workers/dispatchScheduledJobs");
      scheduleInMemory(job);
  
      res.status(201).json({ message: "Template job scheduled", job });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  };