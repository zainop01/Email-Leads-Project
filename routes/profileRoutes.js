const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar         // new
} = require("../controllers/profileController");

const router = express.Router();
router.use(protect);

router.get("/",          getProfile);
router.put("/",          updateProfile);
router.put("/password",  changePassword);

// new avatar endpoint
// multipart/form-data with field name "avatar"
router.put("/avatar", upload.single("avatar"), uploadAvatar);

module.exports = router;