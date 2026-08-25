const express = require('express');
const router = express.Router();
const QuestController = require('../Controllers/QuestController');

const worldGate = require('../middleware/worldGate');
const villageOwner = require('../middleware/villageOwner');
const { protect } = require('../middleware/authMiddleware');

router.get('/:worldId/village/:villageId/quests', protect, worldGate, villageOwner, QuestController.getQuests);
router.post('/:worldId/village/:villageId/quests/claim', protect, worldGate, villageOwner, QuestController.claimQuest);

module.exports = router;
