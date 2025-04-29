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

module.exports = router;
