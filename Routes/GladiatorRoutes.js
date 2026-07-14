const express = require('express');
const router = express.Router();
const gladiatorController = require('../Controllers/GladiatorController');
const worldGate = require('../middleware/worldGate');
const { protect } = require('../middleware/authMiddleware');

router.post('/:worldId/village/:villageID/train-gladiator',   protect, worldGate, gladiatorController.trainGladiator);
router.post('/:worldId/village/:villageID/challenge',          protect, worldGate, gladiatorController.challengeGladiator);
router.get('/:worldId/village/:villageID/gladiators',          protect, worldGate, gladiatorController.getVillageGladiators);

module.exports = router;
