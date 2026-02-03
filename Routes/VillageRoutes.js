const express = require('express');
const router = express.Router();
const VillageController = require('../Controllers/VillageController');
const Village = require('../Models/Village');


router.get('/world', VillageController.getWorldMap);

router.post('/recruit', VillageController.recruitTroops);

// This results in: GET /api/village/player/:playerId
router.get('/player/:playerId', VillageController.getVillageByPlayer);

router.get('/my-main', VillageController.getMyMainVillage); 

// Existing routes
router.get('/:id', VillageController.getVillageById);
router.post('/upgrade', VillageController.startUpgrade);

router.get('/admin/fix-database', async (req, res) => {
    try {
        const result = await Village.updateMany(
            { "buildings.warehouse": { $exists: false } }, 
            { $set: { 
                "buildings.warehouse": 1, 
                "lastResourceUpdate": new Date(),
                "resources.wood": 500,
                "resources.clay": 500,
                "resources.iron": 500
            } }
        );
        res.send(`Successfully updated ${result.modifiedCount} villages.`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;