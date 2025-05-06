// routes/emailRoutes.js

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { protect } = require("../middleware/authMiddleware");
const {
  sendBulkEmail,
  getHistory,
  getJobRecords,
  updateServiceName,
  toggleBookmark
} = require("../controllers/emailController");
const EmailRecord = require("../models/EmailRecord");

const router = express.Router();

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename:    (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(protect);

// Create & send a new job/service
router.post("/send", upload.single("file"), sendBulkEmail);

// List all jobs/services
router.get("/history", getHistory);

// Get per-email records for one job
router.get("/history/:jobId", getJobRecords);

// Update the service (job) name
router.post("/service/:jobId", updateServiceName);

// Toggle bookmark on a service
router.post("/service/:jobId/bookmark", toggleBookmark);

router.get("/track/open/:recordId", async (req, res) => {
  try {
    const { recordId } = req.params;
    await EmailRecord.findByIdAndUpdate(recordId, {
      status: "opened",
      openedAt: new Date()
    });
    
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
      "base64"
    );

    res.set("Content-Type", "image/png");
    res.send(pixel);
  } catch (err) {
    console.error(err);
    res.status(500).send();
  }
});


router.post("/track/reply/:recordId", async (req, res) => {
  try {
    const record = await EmailRecord.findByIdAndUpdate(
      req.params.recordId,
      { status: "replied", repliedAt: new Date() },
      { new: true }
    );
    res.json({ message: "Marked as replied", record });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/track/spam/:recordId", async (req, res) => {
  try {
    const record = await EmailRecord.findByIdAndUpdate(
      req.params.recordId,
      { status: "spam", spamAt: new Date() },
      { new: true }
    );
    res.json({ message: "Marked as spam", record });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
