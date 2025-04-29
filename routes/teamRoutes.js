const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  createTeam,
  getTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  inviteMember,
  acceptInvite,
  removeMember,
  updateMemberRole
} = require("../controllers/teamController");

const router = express.Router();

// public accept invite needs user authenticated
router.post("/:id/invite/accept", protect, acceptInvite);

router.use(protect);
router.post("/",                       createTeam);
router.get("/",                        getTeams);
router.get("/:id",                     getTeam);
router.put("/:id",                     updateTeam);
router.delete("/:id",                  deleteTeam);

router.post("/:id/invite",             inviteMember);
router.delete("/:id/members/:memberId", removeMember);
router.put("/:id/members/:memberId/role", updateMemberRole);

module.exports = router;
