const express = require('express');
const router = express.Router();
const gladiatorController = require('../Controllers/GladiatorController');
const worldGate = require('../middleware/worldGate');
const villageOwner = require('../middleware/villageOwner');
const { protect } = require('../middleware/authMiddleware');

router.post('/:worldId/village/:villageID/train-gladiator',   protect, worldGate, villageOwner, gladiatorController.trainGladiator);
router.post('/:worldId/village/:villageID/challenge',          protect, worldGate, villageOwner, gladiatorController.challengeGladiator);
router.get('/:worldId/village/:villageID/gladiators',          protect, worldGate, gladiatorController.getVillageGladiators);

module.exports = router;
