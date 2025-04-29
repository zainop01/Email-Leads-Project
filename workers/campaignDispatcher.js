// workers/campaignDispatcher.js

const schedule           = require("node-schedule");
const Campaign           = require("../models/Campaign");
const CampaignExecution  = require("../models/CampaignExecution");
const EmailRecord        = require("../models/EmailRecord");
const nodemailer         = require("nodemailer");

// 1) configure your transporter once
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "zainop001@gmail.com",
    pass: "inahbuqfbbxfwvpd"
  }
});

transporter.verify()
  .then(() => console.log("✅ Mailer ready"))
  .catch(err => console.error("❌ Mailer config error:", err));

// 2) processing one execution record
async function processExecution(execId) {
  const exec = await CampaignExecution.findById(execId);
  if (!exec || exec.status !== "scheduled") return;

  // ensure campaign still running
  const camp = await Campaign.findById(exec.campaign);
  if (!camp || camp.status !== "running") {
    exec.status = "skipped";
    return exec.save();
  }

  exec.status = "processing";
  await exec.save();

  try {
    await transporter.sendMail({
      from: `"${exec.senderName}" <${exec.senderEmail}>`,
      to:   exec.contactEmail,
      subject: exec.subject,
      html: exec.htmlBody
    });
    exec.status = "sent";
    exec.sentAt = new Date();
  } catch (err) {
    exec.status = "failed";
    exec.error  = err.message;
  }
  await exec.save();

  // record for history
  await EmailRecord.create({
    job:    exec._id,           // you may link to EmailJob or execId
    email:  exec.contactEmail,
    status: exec.status,
    error:  exec.error
  });

  // schedule next step if any and if sent successfully
  if (exec.status === "sent") {
    const campRef = await Campaign.findById(exec.campaign);
    const nextStep = campRef.steps[exec.stepIndex + 1];
    if (nextStep) {
      const delayMs = nextStep.delayMinutes * 60_000;
      const nextSend = new Date(Date.now() + delayMs);

      // pick template or manual for next step
      let {
        serviceName,
        subject,
        senderName,
        senderEmail,
        htmlBody
      } = nextStep;

      if (nextStep.template) {
        const tpl = await Template.findById(nextStep.template);
        serviceName  = tpl.serviceName  || serviceName;
        subject      = tpl.subject      || subject;
        senderName   = tpl.senderName   || senderName;
        senderEmail  = tpl.senderEmail  || senderEmail;
        htmlBody     = tpl.htmlBody     || htmlBody;
      }

      const nextExec = await CampaignExecution.create({
        campaign:     exec.campaign,
        stepIndex:    exec.stepIndex + 1,
        contactEmail: exec.contactEmail,
        serviceName,
        subject,
        senderName,
        senderEmail,
        htmlBody,
        scheduleAt:   nextSend
      });
      scheduleJobExec(nextExec);
    }
  }
}

// 3) schedule a single execution in-memory
function scheduleJobExec(exec) {
  const now = new Date();
  if (exec.scheduleAt > now) {
    schedule.scheduleJob(exec._id.toString(), exec.scheduleAt, () => {
      processExecution(exec._id).catch(console.error);
    });
    console.log(`⏰ Execution ${exec._id} scheduled at ${exec.scheduleAt.toISOString()}`);
  } else {
    console.log(`▶️  Execution ${exec._id} is due (${exec.scheduleAt}); running now`);
    processExecution(exec._id).catch(console.error);
  }
}

// 4) kick off any pending executions on startup
async function initCampaignDispatcher() {
  const pendings = await CampaignExecution.find({ status: "scheduled" });
  pendings.forEach(scheduleJobExec);
  console.log(`🔁 Loaded ${pendings.length} pending executions`);
}

module.exports = { initCampaignDispatcher, scheduleJobExec };
