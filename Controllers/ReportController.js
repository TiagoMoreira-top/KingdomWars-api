const { ReportSchema } = require('../Models/Report');

exports.getReports = async (req, res) => {
  try {
    // 1. 🏰 GATHER THE ARCHIVE
    // Using the dynamic model getter from your middleware
    const ReportModel = req.getReportModel ? req.getReportModel() : req.worldConn.model('Report', ReportSchema);

    // 2. 🔍 FILTER THE SCROLLS
    // We only fetch reports where the 'recipient' is the current Lord
    // and we sort by 'createdAt' descending (newest first)
    const reports = await ReportModel.find({ 
      recipient: req.worldPlayer._id 
    })
    .sort({ createdAt: -1 })
    .limit(50); // We limit to 50 to keep the scrolls manageable

    // 3. 📜 DELIVER TO THE MONARCH
    res.status(200).json({
      success: true,
      count: reports.length,
      reports: reports
    });

  } catch (error) {
    console.error("Archive Retrieval Error:", error);
    res.status(500).json({ 
      error: "⚡ OMEN: The Royal Archive is locked by a dark force. The scribes cannot enter." 
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { reportId } = req.params;
    const ReportModel = req.getReportModel ? req.getReportModel() : req.worldConn.model('Report', ReportSchema);

    const report = await ReportModel.findOneAndUpdate(
      { _id: reportId, recipient: req.worldPlayer._id },
      { status: 'READ' },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ error: "📜 MYSTERY: That scroll does not exist in thy collection." });
    }

    res.status(200).json({ success: true, message: "The seal has been broken." });
  } catch (error) {
    res.status(500).json({ error: "The scribe's ink has run dry." });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const ReportModel = req.getReportModel ? req.getReportModel() : req.worldConn.model('Report', ReportSchema);
    await ReportModel.updateMany(
      { recipient: req.worldPlayer._id, status: 'UNREAD' },
      { status: 'READ' }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "The scribes could not mark all scrolls." });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const ReportModel = req.getReportModel ? req.getReportModel() : req.worldConn.model('Report', ReportSchema);
    const report = await ReportModel.findOneAndDelete({ _id: reportId, recipient: req.worldPlayer._id });
    if (!report) return res.status(404).json({ error: "Scroll not found." });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "The scroll could not be destroyed." });
  }
};

exports.deleteAllReports = async (req, res) => {
  try {
    const ReportModel = req.getReportModel ? req.getReportModel() : req.worldConn.model('Report', ReportSchema);
    await ReportModel.deleteMany({ recipient: req.worldPlayer._id });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "The archive could not be cleared." });
  }
};