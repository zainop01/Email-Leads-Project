const bcrypt    = require("bcryptjs");
const fs        = require("fs");
const path      = require("path");
const User      = require("../models/User");
const cloudinary= require("../utils/cloudinary");


// @desc    Get current user profile
// @route   GET /api/profile
// @access  Private
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -__v");
  res.json(user);
};

// @desc    Update profile fields
// @route   PUT /api/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  const { name, avatarUrl, bio, company, phone, settings } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: "User not found" });

  // assign only provided fields
  if (name)      user.name       = name;
  if (avatarUrl) user.avatarUrl  = avatarUrl;
  if (bio)       user.bio        = bio;
  if (company)   user.company    = company;
  if (phone)     user.phone      = phone;
  if (settings)  user.settings   = { ...user.settings, ...settings };

  await user.save();
  res.json(user);
};

// @desc    Change password
// @route   PUT /api/profile/password
// @access  Private
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Both current and new passwords required" });
  }

  const user = await User.findById(req.user._id);
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  res.json({ message: "Password updated successfully" });
};


exports.uploadAvatar = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
  
      // 1) Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "user_avatars",
        use_filename: true,
        unique_filename: false,
        overwrite: true
      });
  
      // 2) Update user record
      const user = await User.findById(req.user._id);
      // optional: remove old avatar from Cloudinary if you stored public_id
      user.avatarUrl = result.secure_url;
      await user.save();
  
      // 3) Cleanup temp file
      fs.unlink(req.file.path, () => {});
  
      res.json({ message: "Avatar updated", avatarUrl: result.secure_url });
    } catch (err) {
      console.error("Avatar upload error:", err);
      res.status(500).json({ message: "Server error" });
    }
  };