const dotenv = require("dotenv");
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const emailRoutes = require("./routes/emailRoutes");
const templateRoutes = require("./routes/templateRoutes");
const scheduleRoutes  = require("./routes/scheduleRoutes");
const profileRoutes = require("./routes/profileRoutes");
const teamRoutes = require("./routes/teamRoutes");
const { init: initCampaigns } = require("./workers/dispatchCampaigns");
const campaignRoutes = require("./routes/campaignRoutes");
const execRoutes = require("./routes/campaignExecutionRoutes");
const smtpAccountRoutes = require("./routes/smtpAccountRoutes");
const trackRoutes = require("./routes/trackRoutes");

const fs = require("fs");
const { init: initDispatcher } = require("./workers/dispatchScheduledJobs");

dotenv.config();
connectDB();


if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

 // once DB is ready, schedule all existing “scheduled” jobs

const app = express();

app.use(express.json());
app.use(cors());
app.use("/api/auth", authRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/schedule",  scheduleRoutes);
app.use("/api/profile",  profileRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/executions", execRoutes);
app.use("/api/smtp-accounts", smtpAccountRoutes);
app.use("/api/emails/track", trackRoutes);

initDispatcher().catch(err => console.error("Dispatcher init failed:", err));
initCampaigns().catch(err => console.error("Campaign dispatcher failed:", err));

 // start the scheduler in the background
//  require("./workers/scheduler");

app.get("/", (req, res) => {
  res.send("API is Running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));