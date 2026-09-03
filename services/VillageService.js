const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');
const getWorldConnection = require('../config/dbManager');

const { VillageSchema } = require('../Models/Village');
const { MissionSchema } = require('../Models/Mission');
const { GladiatorSchema } = require('../Models/Mission');
const { DragonSchema } = require('../Models/Dragon');
const { MarketOfferSchema } = require('../Models/MarketOffer');

const BuildingService = require('./BuildingService');
const ResearchService = require('./ResearchService');
const MilitaryService = require('./MilitaryService');
const CensusService = require('./CensusService');
const ResourceService = require('./ResourceService');
const MissionService = require('./MissionService');
const GladiatorService = require('./GladiatorService');
const DragonService = require('./DragonService');
const MarketService = require('./MarketService');
const WorldPlayerSchema = require('../Models/WorldPlayer');

/**
 * 🔐 One tick at a time, per village.
 *
 * getUpdatedVillage reads the whole village, mutates it through six services
 * and saves it back. Two of those overlapping on the same village means the
 * loser saves against a stale version and Mongoose rejects it (VersionError).
 *
 * Keyed by village id, so unrelated villages are never held up by each other.
 * The entry is deleted once the chain drains, so this cannot grow unbounded.
 */
const villageLocks = new Map();

function withVillageLock(villageId, fn) {
  const key = String(villageId);
  const prior = villageLocks.get(key) || Promise.resolve();

  // Chain onto whatever is already running for this village. `.catch` keeps a
  // failed tick from poisoning every tick queued behind it.
  const run = prior.catch(() => {}).then(fn);

  villageLocks.set(key, run);
  run.catch(() => {}).finally(() => {
    if (villageLocks.get(key) === run) villageLocks.delete(key);
  });

  return run;
}

const VillageService = {

    /**
     * Tick a village and return it. Serialised per village, with one retry if
     * a writer outside this process still manages to move the version.
     */
    async getUpdatedVillage(villageId, world, kingLevel = null) {
        return withVillageLock(villageId, async () => {
            try {
                return await VillageService._tickVillage(villageId, world, kingLevel);
            } catch (err) {
                if (err?.name !== 'VersionError') throw err;
                // Someone else moved the document. Re-read and tick once more.
                return await VillageService._tickVillage(villageId, world, kingLevel);
            }
        });
    },

    async _tickVillage(villageId, world, kingLevel = null)
    {
        const worldConn = getWorldConnection(world.dbName);
        const VillageModel = worldConn.models.Village || worldConn.model('Village', VillageSchema);
        const MissionModel = worldConn.models.Mission || worldConn.model('Mission', MissionSchema);
        const MarketOfferModel = worldConn.models.MarketOffer || worldConn.model('MarketOffer', MarketOfferSchema);
        worldConn.models.Dragon || worldConn.model('Dragon', DragonSchema);


        let village = await VillageModel.findById(villageId).populate('gladiators').populate('dragons');
        if (!village)
        {
            throw new Error("⚔️ EXILE: Thou hast no land in this realm!");
        }

        const now = Date.now();

        // Resolve king level for perk application (only look up if not passed in)
        let resolvedKingLevel = kingLevel;
        if (resolvedKingLevel === null) {
          try {
            const WPModel = worldConn.models.WorldPlayer || worldConn.model('WorldPlayer', WorldPlayerSchema);
            const wp = await WPModel.findOne({ _id: village.ownerId }).select('kingLevel race').lean();
            resolvedKingLevel = wp?.kingLevel || 1;
            village._crown = wp || null;
            village._raceKey = wp?.race || 'ashvale';
          } catch (_) { resolvedKingLevel = 1; }
        }

        // 🏗️ 1. MASONRY SERVICE
        // 📜 Settle finished studies first, so knowledge earned this tick
        // is already paying out when resources are calculated below.
        village = ResearchService.processResearch(village, now);

        village = BuildingService.processUpgrades(village, now);
        const completedBuildings = village._completedBuildingCount || 0;
        if (completedBuildings > 0 && worldConn.models.WorldPlayer) {
          const WPModel = worldConn.models.WorldPlayer;
          const xpGain = completedBuildings * 10;
          const wp = await WPModel.findOneAndUpdate(
            { _id: village.ownerId },
            { $inc: { 'stats.buildingsConstructed': completedBuildings, kingXP: xpGain } },
            { new: true, select: 'kingXP' }
          );
          if (wp) {
            const newLevel = Math.min(20, Math.floor(Math.sqrt(wp.kingXP / 100)) + 1);
            await WPModel.updateOne({ _id: village.ownerId }, { kingLevel: newLevel });
          }
        }

        // ⚔️ 2. WAR SERVICE
        village = MilitaryService.processRecruitment(village, now);
        village = GladiatorService.processTraining(village, now);
        village = DragonService.processHatching(village, now);

        // 🪵 3. RESOURCE SERVICE
        village = ResourceService.tick(village, village._crown || resolvedKingLevel, ResearchService.getModifiers(village, village._raceKey || 'ashvale'));

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
        await Promise.all((village.dragons || []).map(d => d.save()));

        // Final Population for Frontend
        await village.populate([
            { path: 'gladiators' },
            { path: 'dragons' },
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