const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getExecutions, getExecutionById } = require("../controllers/campaignExecutionController");

const router = express.Router();
router.use(protect);

// list or filter executions
router.get("/", getExecutions);
// get single execution details
router.get("/:id", getExecutionById);

module.exports = router;