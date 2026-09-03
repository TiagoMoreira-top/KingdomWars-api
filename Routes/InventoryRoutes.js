const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const worldGate = require('../middleware/worldGate');
const I = require('../Controllers/InventoryController');

/**
 * 🎒 The baggage belongs to the lord, not to a village, so these hang off the
 * world alongside the crown's own routes.
 */
router.get('/:worldId/inventory',          protect, worldGate, I.getInventory);
router.post('/:worldId/inventory/buy',     protect, worldGate, I.buy);
router.post('/:worldId/inventory/equip',   protect, worldGate, I.equip);
router.post('/:worldId/inventory/unequip', protect, worldGate, I.unequip);
router.post('/:worldId/inventory/use',     protect, worldGate, I.use);

module.exports = router;
