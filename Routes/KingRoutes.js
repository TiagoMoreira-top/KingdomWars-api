const express = require('express');
const router = express.Router();
const KingController = require('../Controllers/KingController');

const worldGate = require('../middleware/worldGate');
const { protect } = require('../middleware/authMiddleware');

// The crown belongs to the lord, not to any one village.
router.get('/:worldId/king', protect, worldGate, KingController.getTree);
router.post('/:worldId/king/spend', protect, worldGate, KingController.spendPoint);
router.post('/:worldId/king/respec', protect, worldGate, KingController.respec);

module.exports = router;
