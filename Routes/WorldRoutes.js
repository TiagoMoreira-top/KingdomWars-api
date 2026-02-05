const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getAvailableWorlds, joinWorld } = require('../Controllers/WorldController');
const { getVillageData } = require('../Controllers/VillageController');

router.get('/', protect, getAvailableWorlds);
router.post('/join/:id', protect, joinWorld);

module.exports = router;