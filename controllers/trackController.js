// controllers/trackController.js
const EmailRecord = require("../models/EmailRecord");

// GET /api/email/track/open/:recordId
exports.trackOpen = async (req, res) => {
  try {
    const { recordId } = req.params;
    const rec = await EmailRecord.findById(recordId);
    if (rec && rec.status !== "opened") {
      rec.status   = "opened";
      rec.openedAt = new Date();
      await rec.save();
    }
    // Respond with a 1×1 transparent GIF
    const img = Buffer.from(
      "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": img.length
    });
    res.end(img);
  } catch (err) {
    res.status(500).end();  // we still return a blank image on error
  }
};