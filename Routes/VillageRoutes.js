const express = require('express');
const router = express.Router();
const VillageController = require('../Controllers/VillageController');

const worldGate = require('../middleware/worldGate');
const { protect } = require('../middleware/authMiddleware');

router.get('/config', VillageController.getConfig);
router.get('/:worldId/village/:villageId', protect, worldGate, VillageController.getVillageData);
router.post('/:worldId/village/:villageId/upgrade-building', protect, worldGate, VillageController.upgradeBuilding);
router.post('/:worldId/village/:villageId/cancel-upgrade', protect, worldGate, VillageController.cancelUpgrade);
router.post('/:worldId/village/:villageId/recruit', protect, worldGate, VillageController.recruitUnits);
router.post('/:worldId/village/:villageId/cancel-recruitment', protect, worldGate, VillageController.cancelRecruitment);
router.put('/:worldId/village/:villageId/rename', protect, worldGate, VillageController.renameVillage);
router.post('/:worldId/village/:villageId/send-mission', protect, worldGate, VillageController.sendMission);
router.post('/:worldId/village/:villageId/buy-slaves', protect, worldGate, VillageController.buySlaves);
router.post('/:worldId/village/:villageId/ascend-gladiator', protect, worldGate, VillageController.ascendToGladiator);
router.post('/:worldId/village/:villageId/hold-mass', protect, worldGate, VillageController.holdMass);
router.post('/:worldId/village/:villageId/hatch-dragon', protect, worldGate, VillageController.hatchDragon);
router.post('/:worldId/village/:villageId/train-dragon', protect, worldGate, VillageController.trainDragon);
router.get('/:worldId/my-villages', protect, worldGate, VillageController.getMyVillages);
router.post('/:worldId/village/:villageId/recover-wounded', protect, worldGate, VillageController.recoverWounded);
router.post('/:worldId/village/:villageId/conquer', protect, worldGate, VillageController.conquerVillage);

module.exports = router;