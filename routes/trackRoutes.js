// routes/trackRoutes.js
const express = require("express");
const { trackOpen } = require("../controllers/trackController");
const router  = express.Router();

// No auth—anyone clicking the img must hit it
router.get("/open/:recordId", trackOpen);

module.exports = router;
