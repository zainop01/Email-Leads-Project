// workers/bulkEmailWorker.js
const EventEmitter         = require("events");
const { getTransporters, pickTransporter } = require("../utils/mailer");
const EmailRecord          = require("../models/EmailRecord");
const EmailJob             = require("../models/EmailJob");
const { render } = require("../utils/templateRenderer");

// emails per minute per transporter
const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 60;

class BulkEmailWorker extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map(); // jobId -> { cancel() }
  }

  async start(jobDoc, rows) {
    const jobId = jobDoc._id.toString();
    if (this.jobs.has(jobId)) throw new Error("Job already running");

    const transporters = await getTransporters(jobDoc.user, jobDoc.smtpAccounts || []);
    if (!transporters.length) throw new Error("No SMTP transporters available");

    // shallow copy queue
    const queue = rows.slice();
    // ms between batches
    const intervalMs = Math.floor(60000 / RATE_LIMIT_PER_MINUTE);

    let cancelled = false;
    const cancel = () => { cancelled = true; };
    this.jobs.set(jobId, { cancel });

    const processBatch = async () => {
      if (cancelled) {
        this.jobs.delete(jobId);
        return;
      }
      if (!queue.length) {
        this.jobs.delete(jobId);
        this.emit("done", jobId);
        return;
      }

      // send one email per transporter
      await Promise.all(transporters.map(async transporter => {
        const row = queue.shift();
        if (!row) return;

        const personalizedSubject = render(jobDoc.subject, row);
        let personalizedHtml      = render(jobDoc.htmlBody, row);

        // log record first
        const rec = await EmailRecord.create({
          job:    jobDoc._id,
          email:  row.email,
          status: "sent"
        });

        // inject tracking pixel as needed...
        const trackingImg = `<img src="${process.env.BASE_URL}/api/emails/track/open/${rec._id}?cb=${Date.now()}" width="1" height="1" style="display:none" alt="" />`;
        personalizedHtml += trackingImg;

        try {
          await transporter.sendMail({
            from:    `"${jobDoc.senderName}" <${jobDoc.senderEmail}>`,
            to:       row.email,
            subject: personalizedSubject,
            html:    personalizedHtml
          });
          jobDoc.sentCount++;
        } catch (err) {
          rec.status = "failed";
          rec.error  = err.message;
          await rec.save();
          jobDoc.failedCount++;
        }
      }));

      // persist counts before next tick
      await jobDoc.save();

      // schedule next batch after intervalMs
      setTimeout(processBatch, intervalMs);
    };

    // kick off first batch
    processBatch();
  }

  // allow external cancellation if needed
  cancel(jobId) {
    const entry = this.jobs.get(jobId);
    if (entry) entry.cancel();
  }
}

module.exports = new BulkEmailWorker();