// routes/templateRoutes.js

const express = require("express");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const cloudinary = require("../utils/cloudinary");
const { protect } = require("../middleware/authMiddleware");
const {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  sendByTemplate,
  scheduleByTemplate
} = require("../controllers/templateController");

const router = express.Router();
router.use(protect);

// configure Multer → Cloudinary “raw” storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "csv_templates",
    resource_type: "raw",
    public_id: (req, file) => `tpl_${Date.now()}`,
    format: (req, file) => file.originalname.split(".").pop(),
  },
});

const upload = multer({ storage });

// now `req.file.path` will be the Cloudinary URL
router.post("/",    upload.single("csv"), createTemplate);
router.put("/:id",  upload.single("csv"), updateTemplate);
router.get("/",     getTemplates);
router.get("/:id",  getTemplate);
router.delete("/:id", deleteTemplate);
 router.post("/:id/send",     sendByTemplate);
 router.post("/:id/schedule", scheduleByTemplate);

module.exports = router;
