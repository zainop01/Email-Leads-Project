const crypto      = require("crypto");
const Team        = require("../models/Team");
const TeamInvite  = require("../models/TeamInvite");
const User        = require("../models/User");
const sendEmail   = require("../utils/sendEmails");

// ─── TEAM CRUD ──────────────────────────────────────────

// @desc    Create a new team
// @route   POST /api/teams
// @access  Private
exports.createTeam = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Team name is required" });

  const team = await Team.create({
    name,
    owner: req.user._id,
    members: [{ user: req.user._id, role: "owner" }]
  });
  res.status(201).json(team);
};

// @desc    List teams user belongs to
// @route   GET /api/teams
// @access  Private
exports.getTeams = async (req, res) => {
  const teams = await Team.find({ "members.user": req.user._id });
  res.json(teams);
};

// @desc    Get one team
// @route   GET /api/teams/:id
// @access  Private
exports.getTeam = async (req, res) => {
  const team = await Team.findOne({ 
    _id: req.params.id, 
    "members.user": req.user._id 
  }).populate("members.user", "name email avatarUrl");
  if (!team) return res.status(404).json({ message: "Team not found or access denied" });
  res.json(team);
};

// @desc    Update team name
// @route   PUT /api/teams/:id
// @access  Private (owner or manager)
exports.updateTeam = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "Team not found" });
  // only owner or manager can rename
  const member = team.members.find(m => m.user.equals(req.user._id));
  if (!member || !["owner","manager"].includes(member.role)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  if (req.body.name) team.name = req.body.name;
  await team.save();
  res.json(team);
};

// @desc    Delete a team
// @route   DELETE /api/teams/:id
// @access  Private (owner only)
exports.deleteTeam = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "Team not found" });
  if (!team.owner.equals(req.user._id)) {
    return res.status(403).json({ message: "Only the owner can delete this team" });
  }
  await team.remove();
  res.json({ message: "Team deleted" });
};

// ─── INVITES ──────────────────────────────────────────────

// @desc    Invite a member by email
// @route   POST /api/teams/:id/invite
// @access  Private (owner or manager)
exports.inviteMember = async (req, res) => {
  const { email, role } = req.body; // role: "manager" or "member"
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "Team not found" });
  const member = team.members.find(m => m.user.equals(req.user._id));
  if (!member || !["owner","manager"].includes(member.role)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  // check if user exists
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "No user with that email" });
  }
  if (team.members.find(m => m.user.equals(user._id))) {
    return res.status(400).json({ message: "User is already a member" });
  }

  // create invite record
  const token = crypto.randomBytes(20).toString("hex");
  const invite = await TeamInvite.create({
    team: team._id,
    email,
    role: role || "member",
    token
  });

  // send email
  const link = `${process.env.CLIENT_URL}/teams/${team._id}/accept-invite?token=${token}`;
  const html = `<p>You’ve been invited to join <strong>${team.name}</strong> as <em>${invite.role}</em>.</p>
                <p><a href="${link}">Click here to accept</a></p>`;
  await sendEmail(email, `Invite to join ${team.name}`, html);

  res.json({ message: "Invite sent", inviteId: invite._id });
};

// @desc    Accept an invitation
// @route   POST /api/teams/:id/invite/accept
// @access  Public (via token)
exports.acceptInvite = async (req, res) => {
  const { token } = req.body;
  const invite = await TeamInvite.findOne({ token, status: "pending" });
  if (!invite) return res.status(404).json({ message: "Invalid or expired invite" });

  // add member
  const team = await Team.findById(invite.team);
  team.members.push({ user: req.user._id, role: invite.role });
  await team.save();

  // mark invite accepted
  invite.status = "accepted";
  await invite.save();

  res.json({ message: `You joined ${team.name} as ${invite.role}` });
};

// @desc    Remove a member
// @route   DELETE /api/teams/:id/members/:memberId
// @access  Private (owner or manager)
exports.removeMember = async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "Team not found" });
  const actor = team.members.find(m => m.user.equals(req.user._id));
  if (!actor || !["owner","manager"].includes(actor.role)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  // owner cannot remove themselves unless deleting team
  if (team.owner.equals(req.params.memberId)) {
    return res.status(400).json({ message: "Owner cannot be removed" });
  }
  team.members = team.members.filter(m => !m.user.equals(req.params.memberId));
  await team.save();
  res.json({ message: "Member removed" });
};

// @desc    Update member role
// @route   PUT /api/teams/:id/members/:memberId/role
// @access  Private (owner only)
exports.updateMemberRole = async (req, res) => {
  const { role } = req.body; // manager or member
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ message: "Team not found" });
  if (!team.owner.equals(req.user._id)) {
    return res.status(403).json({ message: "Only owner can change roles" });
  }

  const member = team.members.find(m => m.user.equals(req.params.memberId));
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }
  member.role = role;
  await team.save();
  res.json({ message: "Member role updated" });
};
