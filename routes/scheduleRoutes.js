const express = require("express");
const multer  = require("multer");
const path    = require("path");
const { protect } = require("../middleware/authMiddleware");
const {
  scheduleBulkEmail,
  getScheduledJobs,
  updateScheduledJob,
  deleteScheduledJob
} = require("../controllers/scheduleController");

const router = express.Router();
router.use(protect);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename:    (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.post("/",    upload.single("file"), scheduleBulkEmail);
router.get("/",     getScheduledJobs);
router.put("/:id",  updateScheduledJob);
router.delete("/:id", deleteScheduledJob);

module.exports = router;
