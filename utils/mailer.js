// utils/mailerManager.js
const nodemailer   = require("nodemailer");
const SmtpAccount  = require("../models/SmtpAccount");

// given an array of SMTP Account IDs and a user ID, return transporter instances
async function getTransporters(userId, accountIds = []) {
  let configs;
  if (accountIds.length) {
    configs = await SmtpAccount.find({
      _id: { $in: accountIds },
      user: userId
    });
  }
  // fallback to default single account from env
  if (!configs || configs.length === 0) {
    return [ nodemailer.createTransport({
      service: "Gmail",
      auth: {
       user: "zainop001@gmail.com",
    pass: "inahbuqfbbxfwvpd"
      }
    }) ];
  }

  return configs.map(cfg =>
    nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.authUser, pass: cfg.authPass }
    })
  );
}

// picks a transporter from the list in round-robin fashion
let lastIndex = 0;
function pickTransporter(transporters) {
  if (transporters.length === 1) return transporters[0];
  const idx = lastIndex % transporters.length;
  lastIndex = (lastIndex + 1) % transporters.length;
  return transporters[idx];
}

module.exports = { getTransporters, pickTransporter };