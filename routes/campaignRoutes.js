// routes/campaignRoutes.js
const express    = require("express");
const multer     = require("multer");
const path       = require("path");
const { protect }= require("../middleware/authMiddleware");
const ctrl       = require("../controllers/campaignController");

const router = express.Router();
router.use(protect);

// CSV upload dir
const uploadDir = path.join(__dirname, "../uploads");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:   (_req, file, cb) =>
    cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// CRUD draft
router.post("/",                 ctrl.createCampaign);
router.get("/",                  ctrl.getCampaigns);
router.get("/:id",               ctrl.getCampaign);
router.put("/:id",               ctrl.updateCampaign);
router.delete("/:id",            ctrl.deleteCampaign);

// Campaign control
router.post("/:id/start",   upload.single("file"), ctrl.startCampaign);
router.post("/:id/pause",                       ctrl.pauseCampaign);
router.post("/:id/resume",                      ctrl.resumeCampaign);
router.post("/:id/cancel",                      ctrl.cancelCampaign);


module.exports = router;