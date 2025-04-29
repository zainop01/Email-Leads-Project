// workers/scheduler.js

const cron         = require("node-cron");
const mongoose     = require("mongoose");
const nodemailer   = require("nodemailer");
const ScheduledJob = require("../models/ScheduledJob");
const EmailRecord  = require("../models/EmailRecord");

// 1) Set up your mail transporter once
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 2) Every minute, look for jobs due to run
cron.schedule("* * * * *", async () => {
  const now = new Date();
  try {
    // Find jobs still “scheduled” and whose time has come
    const jobs = await ScheduledJob.find({
      status:      "scheduled",
      scheduleAt: { $lte: now },
    });

    for (let job of jobs) {
      // mark as processing so we don’t double-run
      job.status = "processing";
      await job.save();

      // send to each recipient
      for (let email of job.recipients) {
        try {
          await transporter.sendMail({
            from: `"${job.senderName}" <${job.senderEmail}>`,
            to: email,
            subject: job.subject,
            html: job.htmlBody,
          });
          await EmailRecord.create({
            job:    job._id,
            email,
            status: "sent",
          });
          job.sentCount++;
        } catch (err) {
          await EmailRecord.create({
            job:    job._id,
            email,
            status: "failed",
            error:  err.message,
          });
          job.failedCount++;
        }
      }

      // once all done, mark complete
      job.status = "completed";
      await job.save();
    }
  } catch (err) {
    console.error("Scheduler error:", err);
  }
});
