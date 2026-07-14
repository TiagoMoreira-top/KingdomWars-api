const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getAvailableWorlds, joinWorld, getMap, getWorldCensus, getWorldRankings, getHallOfFame } = require('../Controllers/WorldController');
const { getVillageData } = require('../Controllers/VillageController');
const worldGate = require('../middleware/worldGate');

router.get('/', protect, getAvailableWorlds);
router.post('/join/:id', protect, joinWorld);
router.get('/map/:worldId', protect, worldGate, getMap);
router.get('/census/:worldId', protect, worldGate, getWorldCensus);
router.get('/rankings/:worldId', protect, worldGate, getWorldRankings);
router.get('/hall-of-fame/:worldId', protect, getHallOfFame);

module.exports = router;