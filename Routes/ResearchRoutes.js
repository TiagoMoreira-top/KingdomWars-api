const express = require('express');
const router = express.Router();
const ResearchController = require('../Controllers/ResearchController');

const worldGate = require('../middleware/worldGate');
const villageOwner = require('../middleware/villageOwner');
const { protect } = require('../middleware/authMiddleware');

// Reading the stacks of a village you hold
router.get('/:worldId/village/:villageId/research', protect, worldGate, villageOwner, ResearchController.getResearchState);

// Setting the scholars to work, and calling them off
router.post('/:worldId/village/:villageId/research', protect, worldGate, villageOwner, ResearchController.startResearch);
router.post('/:worldId/village/:villageId/research/cancel', protect, worldGate, villageOwner, ResearchController.cancelResearch);

module.exports = router;
