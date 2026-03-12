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
        if (!village) throw new Error("⚔️ EXILE: Thou hast no land in this realm!");

        const now = Date.now();

        // 🏗️ 1. MASONRY SERVICE: Handle Construction
        village = BuildingService.processUpgrades(village, now);

        // ⚔️ 2. WAR SERVICE: Handle Recruitment
        village = MilitaryService.processRecruitment(village, now);
        village = GladiatorService.processTraining(village, now);

        // 🪵 3. RESOURCE SERVICE: Harvest Production
        village = ResourceService.tick(village);

        // 🏹 4. MISSION SERVICE: Handle Arrivals
        village = await MissionService.processArrivals(village, worldConn, now);

        // 🐎 5. MARKET SERVICE: Handle Logistics & Merchant Returns
        village = MarketService.processMovements(village, now);

        // 🔍 FETCH OFFERS: Since they are removed from the model, we fetch them manually
        // We attach them to the village object so CensusService can see them
        const marketOffers = await MarketOfferModel.find({ originVillageId: village._id });
        village.marketOffers = marketOffers;

        // 👨‍🌾 6. CENSUS SERVICE: Recalculate Points, Population & Merchants
        // Now receives the village with .marketOffers manually attached
        village = CensusService.recalculateStats(village);

        // 📜 FINAL DECREE: Save changes
        await village.save();

        // Save gladiator changes if necessary
        await Promise.all(village.gladiators.map(g => g.save()));

        // Populate for Frontend
        await village.populate([
            {
                path: 'gladiators',
            },
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

        // Note: Since marketOffers isn't in the schema, it won't persist in the 
        // plain village object after some Mongoose operations unless we re-attach it
        // or include it in the final return object for the frontend.
        const result = village.toObject();
        result.marketOffers = marketOffers;
        
        return result;
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