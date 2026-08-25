const express = require('express');
const router = express.Router();
const VillageController = require('../Controllers/VillageController');

const worldGate = require('../middleware/worldGate');
const villageOwner = require('../middleware/villageOwner');
const { protect } = require('../middleware/authMiddleware');

/**
 * Read-only routes stay open to any lord of the realm — scouting a
 * neighbour's holding is fair play. Every route that CHANGES a village
 * additionally passes through `villageOwner`, which proves the caller
 * actually holds it.
 */

router.get('/config', VillageController.getConfig);
router.get('/:worldId/village/:villageId', protect, worldGate, VillageController.getVillageData);
router.get('/:worldId/my-villages', protect, worldGate, VillageController.getMyVillages);

// ── Works and conscription ──
router.post('/:worldId/village/:villageId/upgrade-building', protect, worldGate, villageOwner, VillageController.upgradeBuilding);
router.post('/:worldId/village/:villageId/cancel-upgrade', protect, worldGate, villageOwner, VillageController.cancelUpgrade);
router.post('/:worldId/village/:villageId/finish-building', protect, worldGate, villageOwner, VillageController.finishBuilding);
router.post('/:worldId/village/:villageId/recruit', protect, worldGate, villageOwner, VillageController.recruitUnits);
router.post('/:worldId/village/:villageId/cancel-recruitment', protect, worldGate, villageOwner, VillageController.cancelRecruitment);

// ── The lord's own affairs ──
router.put('/:worldId/village/:villageId/rename', protect, worldGate, villageOwner, VillageController.renameVillage);
router.post('/:worldId/village/:villageId/send-mission', protect, worldGate, villageOwner, VillageController.sendMission);
router.post('/:worldId/village/:villageId/buy-slaves', protect, worldGate, villageOwner, VillageController.buySlaves);
router.post('/:worldId/village/:villageId/ascend-gladiator', protect, worldGate, villageOwner, VillageController.ascendToGladiator);
router.post('/:worldId/village/:villageId/hold-mass', protect, worldGate, villageOwner, VillageController.holdMass);
router.post('/:worldId/village/:villageId/hatch-dragon', protect, worldGate, villageOwner, VillageController.hatchDragon);
router.post('/:worldId/village/:villageId/train-dragon', protect, worldGate, villageOwner, VillageController.trainDragon);
router.post('/:worldId/village/:villageId/recover-wounded', protect, worldGate, villageOwner, VillageController.recoverWounded);

// Conquest reads the TARGET village, which by definition is not thine —
// the handler verifies the attacking village instead.
router.post('/:worldId/village/:villageId/conquer', protect, worldGate, villageOwner, VillageController.conquerVillage);

module.exports = router;
