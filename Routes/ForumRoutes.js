const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const worldGate = require('../middleware/worldGate');
const F = require('../Controllers/ForumController');

/**
 * 🏛️ The alliance hall. Membership is checked inside every handler against the
 * caller's own allianceId, so there is no route here that can read or touch
 * another alliance's threads.
 */
router.get('/:worldId/forum',                       protect, worldGate, F.listThreads);
router.post('/:worldId/forum/thread',               protect, worldGate, F.createThread);
router.get('/:worldId/forum/thread/:threadId',      protect, worldGate, F.getThread);
router.post('/:worldId/forum/thread/:threadId/reply', protect, worldGate, F.reply);
router.post('/:worldId/forum/thread/:threadId/pin',   protect, worldGate, F.togglePin);
router.post('/:worldId/forum/thread/:threadId/lock',  protect, worldGate, F.toggleLock);
router.delete('/:worldId/forum/thread/:threadId',   protect, worldGate, F.deleteThread);
router.put('/:worldId/forum/post/:postId',          protect, worldGate, F.editPost);
router.delete('/:worldId/forum/post/:postId',       protect, worldGate, F.deletePost);

module.exports = router;
