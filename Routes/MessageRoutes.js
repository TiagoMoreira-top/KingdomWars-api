const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const worldGate = require('../middleware/worldGate');
const M = require('../Controllers/MessageController');

router.get('/:worldId/inbox',              protect, worldGate, M.getInbox);
router.get('/:worldId/outbox',             protect, worldGate, M.getOutbox);
router.get('/:worldId/unread',             protect, worldGate, M.getUnreadCount);
router.get('/:worldId/search',             protect, worldGate, M.searchPlayers);
router.get('/:worldId/message/:messageId', protect, worldGate, M.getMessage);
router.post('/:worldId/send',              protect, worldGate, M.send);
router.post('/:worldId/broadcast',         protect, worldGate, M.sendAllianceBroadcast);
router.delete('/:worldId/message/:messageId', protect, worldGate, M.deleteMessage);

module.exports = router;
