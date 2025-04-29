const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const EmailJob = require("../models/EmailJob");
const EmailRecord = require("../models/EmailRecord");
const parseCSV = require("../utils/parseCSV");
const Template = require("../models/Template");

exports.sendBulkEmail = async (req, res) => {
  try {
    const { serviceName, subject, senderName, senderEmail, htmlBody } = req.body;

    // If a templateId was passed, load it and override fields:

    if (!serviceName || !senderName || !senderEmail || !subject || !htmlBody) {
      return res
        .status(400)
        .json({
          message:
            "serviceName, senderName, senderEmail, subject and htmlBody are all required",
        });
    }
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const filePath = path.join(__dirname, "../uploads", req.file.filename);
    const emails = await parseCSV(filePath);

    // create job with new fields
    const job = await EmailJob.create({
      user: req.user._id,
      serviceName,
      senderName,
      senderEmail,
      subject,
      htmlBody,
      total: emails.length,
    });

    // mailer
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // send & record
    const sendPromises = emails.map(async (address) => {
      try {
        await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: address,
          subject,
          html: htmlBody,
        });
        await EmailRecord.create({
          job: job._id,
          email: address,
          status: "sent",
        });
        job.sentCount++;
      } catch (err) {
        await EmailRecord.create({
          job: job._id,
          email: address,
          status: "failed",
          error: err.message,
        });
        job.failedCount++;
      }
    });

    await Promise.all(sendPromises);
    await job.save();

    // cleanup
    fs.unlink(filePath, () => {});

    res.json({
      message: "Emails processed",
      job: {
        id: job._id,
        serviceName: job.serviceName,
        total: job.total,
        sent: job.sentCount,
        failed: job.failedCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc   Fetch user's email‐job history
// @route  GET /api/email/history
exports.getHistory = async (req, res) => {
  try {
    // 1) pull query‐params (with sane defaults)
    const {
      page       = 1,
      perPage    = 10,
      search,                   // string to regex‐search serviceName|subject
      bookmarked,               // 'true' | 'false'
      startDate,                // ISO date string
      endDate,                  // ISO date string
      sortBy     = "createdAt", // any field on EmailJob
      order      = "desc"       // 'asc' or 'desc'
    } = req.query;

    // 2) build Mongoose filter
    const filter = { user: req.user._id };

    if (search) {
      filter.$or = [
        { serviceName: { $regex: search, $options: "i" } },
        { subject:     { $regex: search, $options: "i" } }
      ];
    }
    if (bookmarked !== undefined) {
      filter.bookmarked = bookmarked === "true";
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    // 3) count total matching docs
    const total = await EmailJob.countDocuments(filter);

    // 4) fetch with skip/limit and sort
    const skip      = (Number(page) - 1) * Number(perPage);
    const sortOrder = order === "asc" ? 1 : -1;
    const jobs      = await EmailJob
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(perPage));

    // 5) return envelope
    res.json({
      data: jobs,
      meta: {
        total,
        page:       Number(page),
        perPage:    Number(perPage),
        totalPages: Math.ceil(total / perPage)
      }
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
      status,      // 'sent' | 'failed'
      search,      // regex on email
      page    = 1,
      perPage = 10
    } = req.query;

    const filter = { job: jobId };
    if (status) filter.status = status;
    if (search) {
      filter.email = { $regex: search, $options: "i" };
    }

    const total   = await EmailRecord.countDocuments(filter);
    const skip    = (Number(page) - 1) * Number(perPage);
    const records = await EmailRecord
      .find(filter)
      .skip(skip)
      .limit(Number(perPage));

    res.json({
      data: records,
      meta: {
        total,
        page:       Number(page),
        perPage:    Number(perPage),
        totalPages: Math.ceil(total / perPage)
      }
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
