// routes/campaignRoutes.js
const express = require("express");
const multer  = require("multer");
const { protect } = require("../middleware/authMiddleware");
const {
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignExecutions
} = require("../controllers/campaignController");

const router = express.Router();
const upload = multer({ dest: "./uploads" });

router.use(protect);
router.post("/",            createCampaign);
router.get("/",             getCampaigns);
router.get("/:id",          getCampaign);
router.put("/:id",          updateCampaign);
router.delete("/:id",       deleteCampaign);

router.post("/:id/start",   upload.single("file"), startCampaign);
router.get("/:id/executions", getCampaignExecutions);
router.post("/:id/pause",   pauseCampaign);
router.post("/:id/resume",  resumeCampaign);


module.exports = router;
