// utils/cloudinary.js
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name:   "dycfzdanm",
  api_key:     "926597145189559",
  api_secret:   "KDYtnUio_8esnZT-A_Kp_lXbnNg",
  secure:       true,
});

module.exports = cloudinary;