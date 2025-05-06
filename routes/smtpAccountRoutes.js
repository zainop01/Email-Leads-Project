// routes/smtpAccountRoutes.js
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const ctrl    = require("../controllers/smtpAccountController");
const router  = express.Router();

router.use(protect);

router.post("/",    ctrl.createAccount);
router.get("/",     ctrl.listAccounts);
router.get("/:id",  ctrl.getAccount);
router.put("/:id",  ctrl.updateAccount);
router.delete("/:id", ctrl.deleteAccount);

module.exports = router;