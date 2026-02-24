const express = require('express');
const router = express.Router();
const ReportController = require('../Controllers/ReportController');

const worldGate = require('../middleware/worldGate');
const { protect } = require('../middleware/authMiddleware');

router.get('/:worldId', protect, worldGate, ReportController.getReports);
router.post('/:worldId/:reportId/read', protect, worldGate, ReportController.markAsRead);

module.exports = router;