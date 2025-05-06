// controllers/smtpAccountController.js
const SmtpAccount = require("../models/SmtpAccount");
const nodemailer = require("nodemailer");

async function testSmtpConfig({ host, port, secure, authUser, authPass }) {
  const t = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: authUser,
      pass: authPass,
    },
  });
  // will throw if login fails
  await t.verify();
}

exports.createAccount = async (req, res) => {
  const { name, host, port, secure, authUser, authPass } = req.body;
  // validate body omitted for brevity…

  try {
    // 1) Test credentials
    await testSmtpConfig({ host, port, secure, authUser, authPass });

    // 2) Save only if it worked
    const acct = await SmtpAccount.create({
      user: req.user._id,
      name,
      host,
      port,
      secure,
      authUser,
      authPass,
      verified: true,
      verifiedAt: new Date(),
    });
    res.status(201).json(acct);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({
          message: "An SMTP account with those settings already exists.",
        });
    }
    console.error("SMTP verification failed:", err);
    return res
      .status(400)
      .json({ message: "SMTP credentials invalid: " + err.message });
  }
};

// controllers/smtpAccountController.js

exports.listAccounts = async (req, res) => {
  // 1) Destructure your supported query params:
  const {
    name,         // partial match on account name
    host,         // partial match on host
    verified,     // true|false
    from,         // ISO date string for verifiedAt >= from
    to,           // ISO date string for verifiedAt <= to
    search,       // generic text search across name/host/authUser
    sortBy = 'verifiedAt', 
    sortOrder = 'desc', // 'asc' or 'desc'
    page = 1,
    limit = 20,
  } = req.query;

  // 2) Build the base filter with the logged‐in user
  const filter = { user: req.user._id };

  // 3) Add filters only if they were supplied
  if (name) {
    filter.name = { $regex: name, $options: 'i' };
  }
  if (host) {
    filter.host = { $regex: host, $options: 'i' };
  }
  if (verified !== undefined) {
    filter.verified = verified === 'true';
  }
  if (from || to) {
    filter.verifiedAt = {};
    if (from) filter.verifiedAt.$gte = new Date(from);
    if (to)   filter.verifiedAt.$lte = new Date(to);
  }
  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [
      { name: re },
      { host: re },
      { authUser: re },
    ];
  }

  // 4) Compute pagination parameters
  const pageInt  = Math.max(1, parseInt(page, 10));
  const limitInt = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip     = (pageInt - 1) * limitInt;

  // 5) Perform the query with sorting and pagination
  const sortCriteria = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const [ total, accts ] = await Promise.all([
    SmtpAccount.countDocuments(filter),
    SmtpAccount.find(filter)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limitInt)
  ]);

  // 6) Return results plus pagination metadata
  res.json({
    data: accts,
    meta: {
      total,
      page: pageInt,
      limit: limitInt,
      pages: Math.ceil(total / limitInt),
      sortBy,
      sortOrder,
    }
  });
};


exports.getAccount = async (req, res) => {
  const acct = await SmtpAccount.findOne({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!acct) return res.status(404).json({ message: "Not found" });
  res.json(acct);
};

exports.updateAccount = async (req, res) => {
  const updates = (({ name, host, port, secure, authUser, authPass }) => ({
    name,
    host,
    port,
    secure,
    authUser,
    authPass,
  }))(req.body);

  try {
    // If any of the auth fields were updated, re-test
    if (
      updates.host ||
      updates.port ||
      updates.secure !== undefined ||
      updates.authUser ||
      updates.authPass
    ) {
      // fetch existing for defaults
      const existing = await SmtpAccount.findById(req.params.id);
      const cfg = {
        host: updates.host || existing.host,
        port: updates.port || existing.port,
        secure: updates.secure !== undefined ? updates.secure : existing.secure,
        authUser: updates.authUser || existing.authUser,
        authPass: updates.authPass || existing.authPass,
      };
      await testSmtpConfig(cfg);
      updates.verified = true;
      updates.verifiedAt = new Date();
    }

    // commit update
    const acct = await SmtpAccount.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true }
    );
    if (!acct) return res.status(404).json({ message: "Not found" });
    res.json(acct);
  } catch (err) {
    console.error("SMTP re-verification failed:", err);
    return res
      .status(400)
      .json({ message: "Updated SMTP credentials invalid: " + err.message });
  }
};

exports.deleteAccount = async (req, res) => {
  const acct = await SmtpAccount.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!acct) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
};
