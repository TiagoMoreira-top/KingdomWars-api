const express = require('express');
const router = express.Router();
const gladiatorController = require('../Controllers/GladiatorController');

const worldGate = require('../middleware/worldGate');
const { protect } = require('../middleware/authMiddleware');

router.post('/:worldId/village/:villageID/train-gladiator', protect, worldGate, gladiatorController.trainGladiator);

module.exports = router;