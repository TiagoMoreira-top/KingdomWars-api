const express = require('express');
const router = express.Router();
const PlayerController = require('../Controllers/PlayerController');

const worldGate = require('../middleware/worldGate');
const { protect } = require('../middleware/authMiddleware');

router.get('/me/:worldId', protect, worldGate, PlayerController.getProfile);

module.exports = router;