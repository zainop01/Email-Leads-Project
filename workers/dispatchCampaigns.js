// workers/dispatchCampaigns.js
const schedule       = require("node-schedule");
const Execution      = require("../models/CampaignExecution");
const Campaign       = require("../models/Campaign");
const transporter     = require("../utils/mailer");

// schedule one Execution in memory
function scheduleInMemory(exec) {
    // exec.scheduleAt may be a Date instance or string
    const sendTime = new Date(exec.scheduleAt);
    if (sendTime <= new Date()) {
      // If in the past, process immediately
      processExecution(exec._id).catch(console.error);
      return;
    }
    schedule.scheduleJob(exec._id.toString(), sendTime, () => {
      processExecution(exec._id).catch(console.error);
    });
  }
  
  // Cancel a scheduled job by its ID
  function cancelScheduledJob(jobId) {
    const job = schedule.scheduledJobs[jobId];
    if (job) job.cancel();
  }
  
  // On startup: pick up pending executions
  async function init() {
    const pending = await Execution.find({ status: "scheduled" });
    pending.forEach(scheduleInMemory);
  }
  
  // Processor: handles one Execution
  async function processExecution(execId) {
    const exec = await Execution.findById(execId);
    if (!exec || exec.status !== "scheduled") return;
  
    exec.status = "processing";
    await exec.save();
  
    // Load campaign & step info
    const camp = await Campaign.findById(exec.campaign);
    if (!camp) {
      exec.status = "failed";
      exec.error = "Parent campaign not found";
      await exec.save();
      return;
    }
    const step = camp.steps[exec.stepIndex];
  
    // Determine email content
    let subject, htmlBody, fromName;
    if (step.template) {
      const tpl = await require("../models/Template").findById(step.template);
      subject  = tpl.subject;
      htmlBody = tpl.htmlBody;
      fromName = tpl.senderName;
    } else {
      subject  = step.subject;
      htmlBody = step.body;
      fromName = step.senderName;
    }
  
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${camp.user}>`,
        to:   exec.contactEmail,
        subject,
        html: htmlBody
      });
      exec.status = "sent";
      exec.sentAt = new Date();
    } catch (err) {
      exec.status = "failed";
      exec.error  = err.message;
    }
  
    await exec.save();
  
    // ── NEW: After saving execution, update campaign if done ──
    const remaining = await Execution.countDocuments({
      campaign: exec.campaign,
      status:   { $in: ["scheduled", "processing"] }
    });
    if (remaining === 0) {
      await Campaign.findByIdAndUpdate(exec.campaign, { status: "completed" });
    }
  }
  
  module.exports = {
    init,
    scheduleInMemory,
    cancelScheduledJob,
  };
  