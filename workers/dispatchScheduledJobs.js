// workers/dispatchScheduledJobs.js

const schedule     = require("node-schedule");
const ScheduledJob = require("../models/ScheduledJob");
const EmailJob     = require("../models/EmailJob");
const EmailRecord  = require("../models/EmailRecord");
const nodemailer   = require("nodemailer");

// 1) Configure transporter – and verify it at startup
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "zainop001@gmail.com",
    pass: "inahbuqfbbxfwvpd"
  }
});

transporter.verify()
  .then(() => console.log("✅ Mailer ready"))
  .catch(err => console.error("❌ Mailer configuration error:", err));

// 2) The function that actually processes one job
async function processJob(jobId) {
  const job = await ScheduledJob.findById(jobId);
  if (!job || job.status !== "scheduled") return;

  console.log(`⏳ Processing ScheduledJob ${jobId}`);
  job.status = "processing";
  await job.save();

  // we'll collect each result so that we can re-emit them under EmailJob
  const results = [];

  for (let recipient of job.recipients) {
    try {
      console.log(`✉️  Sending to ${recipient}`);
      await transporter.sendMail({
        from: `"${job.senderName}" <${job.senderEmail}>`,
        to:   recipient,
        subject: job.subject,
        html: job.htmlBody
      });
      results.push({ email: recipient, status: "sent" });
    } catch (err) {
      console.error(`⚠️  Failed to ${recipient}:`, err.message);
      results.push({ email: recipient, status: "failed", error: err.message });
    }
  }

  job.status = "completed";
  await job.save();
  console.log(`✅ ScheduledJob ${jobId} done, ${results.filter(r=>r.status==="sent").length} sent`);

  // 3) **Create** a real EmailJob so it shows up in your normal history endpoint
  const emailJob = await EmailJob.create({
    user:        job.user,
    template:    job.template,
    serviceName: job.serviceName,
    subject:     job.subject,
    senderName:  job.senderName,
    senderEmail: job.senderEmail,
    htmlBody:    job.htmlBody,
    total:       job.total,
    sentCount:   results.filter(r=>r.status==="sent").length,
    failedCount: results.filter(r=>r.status==="failed").length,
    // optional: you could preserve the original schedule time
    scheduledAt: job.scheduleAt  
  });

  // 4) **Clone** each result into EmailRecord under the new EmailJob
  await Promise.all(results.map(r =>
    EmailRecord.create({
      job:    emailJob._id,
      email:  r.email,
      status: r.status,
      error:  r.error
    })
  ));

  console.log(`🔗 ScheduledJob ${jobId} archived as EmailJob ${emailJob._id}`);
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