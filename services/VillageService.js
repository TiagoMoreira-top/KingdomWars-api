const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');
const getWorldConnection = require('../config/dbManager');

const { VillageSchema } = require('../Models/Village');
const { MissionSchema } = require('../Models/Mission');
const { GladiatorSchema } = require('../Models/Mission');
const { MarketOfferSchema } = require('../Models/MarketOffer');

const BuildingService = require('./BuildingService');
const MilitaryService = require('./MilitaryService');
const CensusService = require('./CensusService');
const ResourceService = require('./ResourceService');
const MissionService = require('./MissionService');
const GladiatorService = require('./GladiatorService');
const MarketService = require('./MarketService');

const VillageService = {

    async getUpdatedVillage(villageId, world)
    {
        const worldConn = getWorldConnection(world.dbName);
        const VillageModel = worldConn.models.Village || worldConn.model('Village', VillageSchema);
        const MissionModel = worldConn.models.Mission || worldConn.model('Mission', MissionSchema);
        const MarketOfferModel = worldConn.models.MarketOffer || worldConn.model('MarketOffer', MarketOfferSchema);

        let village = await VillageModel.findById(villageId).populate('gladiators');
        if (!village) 
        {
            throw new Error("⚔️ EXILE: Thou hast no land in this realm!");
        }

        const now = Date.now();

        // 🏗️ 1. MASONRY SERVICE
        village = BuildingService.processUpgrades(village, now);

        // ⚔️ 2. WAR SERVICE
        village = MilitaryService.processRecruitment(village, now);
        village = GladiatorService.processTraining(village, now);

        // 🪵 3. RESOURCE SERVICE
        village = ResourceService.tick(village);

        // 🏹 4. MISSION SERVICE
        village = await MissionService.processArrivals(village, worldConn, now);

        // 🐎 5. MARKET SERVICE
        village = MarketService.processMovements(village, now);

        // 🔍 FETCH OFFERS
        const marketOffers = await MarketOfferModel.find({ originVillageId: village._id });

        /**
         * 💡 THE FIX FOR DOCUMENTS:
         * We use .set() with strict: false so Mongoose doesn't strip the field,
         * OR we assign directly to the internal _doc.
         */
        village.set('marketOffers', marketOffers, { strict: false });

        // 👨‍🌾 6. CENSUS SERVICE: Now sees marketOffers on the document
        village = CensusService.recalculateStats(village);

        // 📜 FINAL DECREE
        await village.save();

        await Promise.all(village.gladiators.map(g => g.save()));

        // Final Population for Frontend
        await village.populate([
            { path: 'gladiators' },
            {
                path: 'outgoingMissions',
                populate: { path: 'targetVillage', select: 'name x y ownerId' }
            },
            {
                path: 'incomingMissions',
                populate: { path: 'originVillage', select: 'name x y ownerId' }
            },
            {
                path: 'reinforcements.originVillageId',
                select: 'name x y ownerId'
            }
        ]);

        /**
         * Since you need the document returned, we re-verify marketOffers 
         * is still attached to the internal state before returning.
         */
        village.set('marketOffers', marketOffers, { strict: false });
        
        return village;
    },
  
    calculateUpgradeCost(buildingKey, currentLevel) {
        const config = BUILDINGS[buildingKey];
        const multiplier = Math.pow(config.costMultiplier, currentLevel);

        return {
            wood: Math.floor(config.baseCost.wood * multiplier),
            clay: Math.floor(config.baseCost.clay * multiplier),
            stone: Math.floor(config.baseCost.stone * multiplier),
            time: Math.floor(config.baseBuildTime * multiplier)
        };
    },

    canBuild(village, buildingKey) {
        const config = BUILDINGS[buildingKey];
        if (!config) {
            return { allowed: false, msg: "⚔️ ERROR: That structure is unknown to our architects!" };
        }

        // 1. Check Building Requirements (The Connection)
        for (const [reqBuilding, reqLevel] of Object.entries(config.requirements)) {
            if (village.buildings[reqBuilding] < reqLevel) {
            return { 
                allowed: false, 
                msg: `⚔️ RESTRICTION: Thy ${reqBuilding} must be Level ${reqLevel}!` 
            };
            }
        }

        // 2. Check Resource Availability
        const nextLevel = village.buildings[buildingKey];
        const cost = this.calculateUpgradeCost(buildingKey, nextLevel);

        if (village.resources.wood < cost.wood || 
            village.resources.clay < cost.clay || 
            village.resources.stone < cost.stone) {
            return { allowed: false, msg: "⚔️ SHORTAGE: We lack the materials for such an undertaking!" };
        }

        return { allowed: true, cost };
    },

    async createNewVillage(player, world) {
        // 1. Connect to the specific world's database
        const worldConn = getWorldConnection(world.dbName);

        // 2. Map the Village Model to THIS specific connection
        const VillageModel = worldConn.model('Village', VillageSchema);

        // ⚔️ PROTECTION: Check if this Lord already holds land here
        const existingVillage = await VillageModel.findOne({ ownerId: player._id });
        if (existingVillage) {
            return existingVillage; 
        }

        let x, y;
        let isOccupied = true;
        let attempts = 0;

        // ⚔️ SEARCH ONLY WITHIN THIS WORLD'S DB
        while (isOccupied && attempts < 50) {
            x = Math.floor(Math.random() * 1000);
            y = Math.floor(Math.random() * 1000);

            const collision = await VillageModel.findOne({ x, y });
            if (!collision) isOccupied = false;
            attempts++;
        }

        if (isOccupied) {
            throw new Error("⚔️ THE LAND IS FULL: No vacant plots in this specific realm!");
        }

        const tempVillage = new VillageModel();
        let initialPoints = 0;

        Object.entries(tempVillage.buildings.toObject()).forEach(([key, level]) => {
            const config = BUILDINGS[key];
            if (config && level > 0) {
                // Formula: Base Value * (Factor ^ (Level - 1))
                const buildingPoints = Math.floor(
                    config.pointValue * Math.pow(config.pointFactor, level - 1)
                );
                initialPoints += buildingPoints;
            }
        });

        // 3. Save the village into the world's database
        const newVillage = new VillageModel({
            name: `${player.username || player.name}'s Settlement`,
            ownerId: player._id,
            worldId: world._id, 
            x: x,
            y: y,
            points: initialPoints
        });

        return await newVillage.save();
    }
};

module.exports = VillageService;