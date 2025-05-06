const Execution = require("../models/CampaignExecution");


exports.getExecutions = async (req, res) => {
  try {
    const {
      campaign,      // filter by campaign ID
      status,        // "scheduled"|"processing"|"sent"|"failed"|"skipped"
      stepIndex,     // number
      email,         // partial match on contactEmail
      page = 1,
      perPage = 20,
      sortBy = "scheduleAt",
      order = "asc"
    } = req.query;

    const filter = {};
    if (campaign) filter.campaign = campaign;
    if (status)   filter.status   = status;
    if (stepIndex !== undefined) filter.stepIndex = Number(stepIndex);
    if (email)    filter.contactEmail = { $regex: email, $options: "i" };

    // only allow user to see their own executions
    // we join Execution -> Campaign to check ownership
    const execQuery = Execution.find(filter).populate({
      path: 'campaign',
      select: '_id',
      match: { user: req.user._id }
    });

    // apply pagination & sorting
    const skip = (Number(page) - 1) * Number(perPage);
    const sortOrder = order === 'asc' ? 1 : -1;

    const total = await execQuery.clone().countDocuments();
    const executions = await execQuery
      .skip(skip)
      .limit(Number(perPage))
      .sort({ [sortBy]: sortOrder });

    res.json({
      data: executions,
      meta: {
        total,
        page: Number(page),
        perPage: Number(perPage),
        totalPages: Math.ceil(total / perPage)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get a single execution detail
// @route   GET /api/executions/:id
// @access  Private
exports.getExecutionById = async (req, res) => {
  try {
    const exec = await Execution.findById(req.params.id).populate('campaign');
    if (!exec || exec.campaign.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Execution not found" });
    }
    res.json(exec);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};