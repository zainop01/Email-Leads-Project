const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const EmailJob = require("../models/EmailJob");
const EmailRecord = require("../models/EmailRecord");
const { parseCSV } = require("../utils/parseCSV");
const Template = require("../models/Template");
const { getTransporters, pickTransporter } = require("../utils/mailer");
const { render } = require("../utils/templateRenderer");
const { default: mongoose } = require("mongoose");
const bulkWorker = require("../workers/bulkEmailWorker");

exports.sendBulkEmail = async (req, res) => {
  try {
    // ── 1) Parse smtpAccountIds from form-data ──
    let rawIds = req.body.smtpAccountIds;
    let smtpAccountIds = [];
    if (Array.isArray(rawIds)) {
      smtpAccountIds = rawIds;
    } else if (typeof rawIds === "string") {
      try { smtpAccountIds = JSON.parse(rawIds); }
      catch { smtpAccountIds = rawIds.split(",").map(s => s.trim()); }
    }
    smtpAccountIds = smtpAccountIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    console.log(">> Using SMTP account IDs:", smtpAccountIds);

    // ── 2) Validate inputs ──
    const { serviceName, subject, senderName, senderEmail, htmlBody } = req.body;
    if (!serviceName || !senderName || !senderEmail || !subject || !htmlBody) {
      return res.status(400).json({
        message: "serviceName, senderName, senderEmail, subject and htmlBody are all required"
      });
    }
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    // ── 3) Parse CSV ──
    const filePath = path.join(__dirname, "../uploads", req.file.filename);
    const rows     = await parseCSV(filePath);
    fs.unlink(filePath, () => {}); // cleanup immediately

    // ── 4) Create the EmailJob ──
    const job = await EmailJob.create({
      user:         req.user._id,
      serviceName,
      senderName,
      senderEmail,
      subject,
      htmlBody,
      total:        rows.length,
      sentCount:    0,
      failedCount:  0,
      smtpAccounts: smtpAccountIds
    });

    // ── 5) Hand off to the background worker ──
    bulkWorker.start(job, rows)
      .then(() => console.log("Bulk job completed:", job._id))
      .catch(err => console.error("Bulk job error:", err));

    // ── 6) Respond immediately ──
    return res.json({
      message: "Emails queued for sending",
      job: {
        id:          job._id,
        serviceName: job.serviceName,
        total:       job.total,
        sent:        job.sentCount,
        failed:      job.failedCount
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc   Fetch user's email‐job history
// @route  GET /api/email/history
exports.getHistory = async (req, res) => {
  try {
    const {
      page,
      perPage,
      search, 
      bookmarked,
      startDate,
      endDate,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = { user: req.user._id };

    if (search) {
      filter.$or = [
        { serviceName: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    if (bookmarked !== undefined) {
      filter.bookmarked = bookmarked === "true";
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sortOrder = order === "asc" ? 1 : -1;
    const query = EmailJob.find(filter).sort({ [sortBy]: sortOrder });

    // If pagination explicitly passed, apply it
    if (page && perPage) {
      const skip = (Number(page) - 1) * Number(perPage);
      query.skip(skip).limit(Number(perPage));
    }

    const jobs = await query.exec();
    const total = await EmailJob.countDocuments(filter);

    res.json({
      data: jobs,
      meta: {
        total,
        page: page ? Number(page) : 1,
        perPage: perPage ? Number(perPage) : total,
        totalPages: perPage ? Math.ceil(total / perPage) : 1,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// @desc   Fetch specific job's records
// @route  GET /api/email/history/:jobId
exports.getJobRecords = async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      status, // 'sent' | 'failed'
      search, // regex on email
      page = 1,
      perPage = 10,
    } = req.query;

    const filter = { job: jobId };
    if (status) filter.status = status;
    if (search) {
      filter.email = { $regex: search, $options: "i" };
    }

    const total = await EmailRecord.countDocuments(filter);
    const skip = (Number(page) - 1) * Number(perPage);
    const records = await EmailRecord.find(filter)
      .skip(skip)
      .limit(Number(perPage));

    res.json({
      data: records,
      meta: {
        total,
        page: Number(page),
        perPage: Number(perPage),
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateServiceName = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { serviceName } = req.body;
    if (!serviceName) {
      return res.status(400).json({ message: "New serviceName is required" });
    }
    const job = await EmailJob.findOneAndUpdate(
      { _id: jobId, user: req.user._id },
      { serviceName },
      { new: true }
    );
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json({ message: "Service name updated", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ——————————————
// 3) Bookmark / Un-bookmark Service
// ——————————————
exports.toggleBookmark = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await EmailJob.findOne({ _id: jobId, user: req.user._id });
    if (!job) return res.status(404).json({ message: "Job not found" });
    job.bookmarked = !job.bookmarked;
    await job.save();
    res.json({
      message: job.bookmarked ? "Bookmarked" : "Un-bookmarked",
      bookmarked: job.bookmarked,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
