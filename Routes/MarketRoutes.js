const express = require('express');
const router = express.Router();
const marketController = require('../Controllers/MarketController');

const worldGate = require('../middleware/worldGate');
const villageOwner = require('../middleware/villageOwner');
 const { protect } = require('../middleware/authMiddleware');

// 🌎 THE GREAT SCROLL: Browse all global offers in the realm
router.get('/:worldId/offers', protect, worldGate, marketController.getOffers);

// 🤝 COVENANT: Accept the terms of another merchant
router.post('/:worldId/village/:villageID/accept-offer/:offerID', protect, worldGate, villageOwner, marketController.acceptOffer);

// 📜 DISPATCH: Send a caravan to distant lands via coordinates
router.post('/:worldId/village/:villageID/send-resources', protect, worldGate, villageOwner, marketController.sendResources);

// ⚖️ PROCLAIM: Post a trade for all lords to see
router.post('/:worldId/village/:villageID/create-offer', protect, worldGate, villageOwner, marketController.createOffer);

// 🔨 RESCIND: Strike a proclamation from the market scrolls
router.delete('/:worldId/village/:villageID/cancel-offer/:offerID', protect, worldGate, villageOwner, marketController.cancelOffer);

module.exports = router;