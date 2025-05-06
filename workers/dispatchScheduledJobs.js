// workers/dispatchScheduledJobs.js

const schedule     = require("node-schedule");
const ScheduledJob = require("../models/ScheduledJob");
const EmailJob     = require("../models/EmailJob");
const EmailRecord  = require("../models/EmailRecord");
const transporter     = require("../utils/mailer");
const bulkEmailWorker = require("./bulkEmailWorker");

// 2) The function that actually processes one job
async function processJob(jobId) {
  const sched = await ScheduledJob.findById(jobId);
  if (!sched || sched.status !== "scheduled") return;

  sched.status = "processing";
  await sched.save();

  // 1) Create a real EmailJob doc so history works exactly the same
  const emailJobDoc = await EmailJob.create({
    user:         sched.user,
    smtpAccounts: sched.smtpAccounts,
    serviceName:  sched.serviceName,
    subject:      sched.subject,
    senderName:   sched.senderName,
    senderEmail:  sched.senderEmail,
    htmlBody:     sched.htmlBody,
    total:        sched.total,
    sentCount:    0,
    failedCount:  0
  });

  // 2) Kick off the BulkEmailWorker using our parsed rows
  //    It will render each row, record success/failure, rate-limit, then
  //    on completion it leaves the EmailJobDoc with final sent/failed counts.
  await bulkEmailWorker.start(emailJobDoc, sched.recipients);

  // 3) Mark the ScheduledJob done (we don’t need per-row on this doc)
  sched.status = "completed";
  await sched.save();
}

// 5) In-memory scheduling
function scheduleInMemory(job) {
  if (job.scheduleAt <= new Date()) {
    console.warn(`Job ${job._id} is in the past; skipping.`);
    return;
  }
  schedule.scheduleJob(job._id.toString(), job.scheduleAt, () => {
    processJob(job._id).catch(console.error);
  });
  console.log(`⏰ ScheduledJob ${job._id} set for ${job.scheduleAt}`);
}

// 6) On startup, pick up any pending jobs
async function init() {
  const pending = await ScheduledJob.find({ status: "scheduled" });
  pending.forEach(scheduleInMemory);
}

module.exports = { init, scheduleInMemory };