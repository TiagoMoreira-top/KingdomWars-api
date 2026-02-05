const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');
const getWorldConnection = require('../config/dbManager');
const { VillageSchema } = require('../Models/Village');
const ResourceService = require('./ResourceService');

const VillageService = {

    async getUpdatedVillage(villageId, world) {
        const worldConn = getWorldConnection(world.dbName);
        const VillageModel = worldConn.model('Village', VillageSchema);

        let village = await VillageModel.findById(villageId);
        if (!village) throw new Error("⚔️ EXILE: Thou hast no land in this realm!");

        const now = Date.now();

        // 🏗️ 1. UPGRADE COMPLETION
        const completedJobs = village.upgradeQueue.filter(job => job.finishTime <= now);
        if (completedJobs.length > 0) {
            completedJobs.forEach(job => {
                const currentLevel = village.buildings[job.building] || 0;
                village.buildings[job.building] = currentLevel + 1;

                const bConfig = BUILDINGS[job.building];
                if (bConfig) {
                    village.points += (bConfig.pointValue || 2);
                }

                village.upgradeQueue.pull(job._id);
            });

            village.markModified('buildings');
            village.markModified('upgradeQueue');
        }

        // ⚔️ 2. RECRUITMENT COMPLETION
        const completedTraining = village.trainingQueue.filter(job => job.finishTime <= now);
        if (completedTraining.length > 0) {
            completedTraining.forEach(job => {
                const currentUnits = village.army[job.unitKey] || 0;
                village.army[job.unitKey] = currentUnits + job.amount;

                village.trainingQueue.pull(job._id);
            });

            village.markModified('army');
            village.markModified('trainingQueue');
        }

        // 👨‍🌾 RECALCULATE CENSUS
        let totalUsed = 0;
        let totalHabitants = 0;
        let totalPoints = 0;

        // 🏠 A. BUILDING CALCULATIONS
        Object.entries(village.buildings).forEach(([bKey, bLvl]) => {
            const config = BUILDINGS[bKey];
            if (!config || bLvl <= 0) return;

            totalPoints += Math.floor(
                (config.pointValue || 2) * Math.pow(config.pointFactor || 1.2, bLvl - 1)
            );

            if (bKey === 'farm') {
                totalHabitants = Math.floor(
                    config.populationBase * Math.pow(config.growthFactor, bLvl - 1)
                );
            } 
            
            if (config.basePop) {
                totalUsed += Math.floor(
                    config.basePop * Math.pow(config.popMultiplier, bLvl - 1)
                );
            }
        });
        
        // 🛡️ B. MILITARY CALCULATIONS (Standing Army)
        Object.entries(village.army).forEach(([uKey, uAmount]) => {
            const uConfig = UNITS[uKey];
            if (uConfig && uAmount > 0) {
                totalUsed += (uAmount * uConfig.population);
            }
        });

        // 🏹 C. QUEUE CALCULATIONS (Units in Training)
        village.trainingQueue.forEach(job => {
            const uConfig = UNITS[job.unitKey];
            if (uConfig) {
                totalUsed += (job.amount * uConfig.population);
            }
        });

        // 📜 Apply the new census
        village.points = totalPoints;
        village.population = {
            habitants: totalHabitants,
            used: totalUsed
        };

        village.markModified('population');

        // ⚔️ RESOURCES: Tick after population/buildings are updated
        village = ResourceService.tick(village); 

        await village.save();
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