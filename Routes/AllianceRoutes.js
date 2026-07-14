const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const worldGate = require('../middleware/worldGate');
const A = require('../Controllers/AllianceController');

router.post('/:worldId/create',         protect, worldGate, A.createAlliance);
router.get('/:worldId/mine',            protect, worldGate, A.getMyAlliance);
router.get('/:worldId/invites',         protect, worldGate, A.getMyInvites);
router.get('/:worldId/list',            protect, worldGate, A.listAlliances);
router.post('/:worldId/invite',         protect, worldGate, A.invite);
router.post('/:worldId/respond',        protect, worldGate, A.respondInvite);
router.post('/:worldId/leave',          protect, worldGate, A.leave);
router.post('/:worldId/kick',           protect, worldGate, A.kick);
router.post('/:worldId/promote',        protect, worldGate, A.promote);
router.post('/:worldId/disband',        protect, worldGate, A.disband);

module.exports = router;
