const World = require('../Models/World');
const VillageService = require('../services/VillageService');
const WorldService = require('../services/WorldService'); // ⚔️ New Service Import

exports.getAvailableWorlds = async (req, res) => {
    try {
        const worlds = await World.find({ status: 'online' }).lean();
        
        const worldsWithStatus = worlds.map(world => ({
            ...world,
            playerCount: world.players.length,
            isRegistered: world.players.some(id => id.toString() === req.player._id.toString())
        }));

        res.status(200).json(worldsWithStatus);
    } catch (error) {
        res.status(500).json({ error: "⚔️ THE LIBRARY IS OBSCURED: Could not retrieve realms." });
    }
};

exports.joinWorld = async (req, res) => {
    try {
        const world = await World.findById(req.params.id);
        if (!world) return res.status(404).json({ error: "⚔️ ERROR: Realm not found." });

        // 1. 📜 INSCRIBE: Ensure the player has a local WorldPlayer profile
        // This connects to the specific world DB via WorldService
        const worldPlayer = await WorldService.getOrCreateWorldPlayer(req.player, world);

        // 2. Register in Master DB (Global World list)
        if (!world.players.includes(req.player._id)) {
            world.players.push(req.player._id);
            await world.save();
        }

        // 3. 🏰 FOUND: Establish the first village
        const village = await VillageService.createNewVillage(worldPlayer, world);

        // 4. 📈 RECORD: Increment village count in the local world DB
        await WorldService.incrementVillages(worldPlayer._id, world);

        res.status(201).json({ 
            success: true, 
            message: "⚔️ WELCOME LORD: Thy title is recognized and thy village established!",
            village: village,
            worldPlayer: worldPlayer // Returning the local profile to the UI
        });

    } catch (error) {
        res.status(500).json({ 
            error: "⚔️ THE COUNCIL DISAGREES: " + (error.message || "Could not join the realm.") 
        });
    }
};