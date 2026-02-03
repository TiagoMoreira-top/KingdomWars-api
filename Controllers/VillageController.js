const Village = require('../Models/Village');
const { calculateResources } = require('../utils/functions');
const Construction = require('../Models/Construction');
const Report = require('../Models/Report');

exports.getVillageData = async (req, res) => {
    try {
        let village = await Village.findById(req.params.id);
        if (!village) return res.status(404).json({ error: "Village not found" });

        // Sync all time-based mechanics
        village = await calculateOfflineResources(village);
        village = await syncUpgradeQueue(village); 
        village = await syncTrainingQueue(village);

        res.json(village);
    } catch (err) {
        res.status(500).json({ error: "Failed to synchronize village data." });
    }
};

exports.startUpgrade = async (req, res) => {
    try {
        const { villageId, buildingName } = req.body;
        const village = await Village.findById(villageId);

        if (!village) return res.status(404).json({ error: "Village not found" });

        const currentLevel = village.buildings[buildingName] || 0;

        const baseCosts = {
            headquarters: { wood: 200, clay: 170, iron: 90 },
            timberCamp: { wood: 50, clay: 50, iron: 40 },
            clayPit: { wood: 65, clay: 40, iron: 40 },
            ironMine: { wood: 75, clay: 65, iron: 70 },
            barracks: { wood: 200, clay: 150, iron: 100 },
            smithy: { wood: 220, clay: 180, iron: 240 }
        };

        const base = baseCosts[buildingName];
        const factor = Math.pow(1.5, currentLevel);
        
        const woodRequired = Math.floor(base.wood * factor);
        const clayRequired = Math.floor(base.clay * factor);
        const ironRequired = Math.floor(base.iron * factor);

        if (village.resources.wood < woodRequired || 
            village.resources.clay < clayRequired || 
            village.resources.iron < ironRequired) {
            return res.status(400).json({ 
                error: `Insufficient resources! Need 🪵${woodRequired}, 🧱${clayRequired}, ⛓️${ironRequired}` 
            });
        }

        if (buildingName === 'barracks' && village.buildings.headquarters < 3) {
            return res.status(400).json({ error: "Headquarters level 3 required." });
        }
        if (buildingName === 'smithy' && (village.buildings.headquarters < 5 || village.buildings.barracks < 1)) {
            return res.status(400).json({ error: "HQ Lvl 5 and Barracks Lvl 1 required." });
        }
        
        if (buildingName === 'academy') {
            if (village.buildings.headquarters < 20 || village.buildings.smithy < 20) {
                return res.status(400).json({ error: "Your architects require a more advanced HQ and Smithy." });
            }
        }

        village.resources.wood -= woodRequired;
        village.resources.clay -= clayRequired;
        village.resources.iron -= ironRequired;

        const buildTime = 60000 * (currentLevel + 1); 

        if (!village.upgradeQueue) {
            village.upgradeQueue = [];
        }

        village.upgradeQueue.push({
            building: buildingName,
            finishTime: Date.now() + buildTime
        });

        await village.save();
        res.json({ message: "Order confirmed, resources deducted.", finishTime: Date.now() + buildTime });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const syncUpgradeQueue = async (village) => {
    const now = Date.now();
    let updated = false;

    // Filter out finished buildings
    const remainingQueue = village.upgradeQueue.filter(item => {
        if (item.finishTime <= now) {
            // The upgrade is finished! 
            // 1. Increase the building level
            village.buildings[item.building] += 1;
            updated = true;
            // 2. Return false to remove it from the queue
            return false;
        }
        // 3. Keep it in the queue if not finished
        return true;
    });

    if (updated) {
        village.upgradeQueue = remainingQueue;
        await village.save();
    }

    return village;
};

exports.getVillageData = async (req, res) => {
    try {
        let village = await Village.findById(req.params.id);
        if (!village) return res.status(404).json({ error: "Village not found" });

        // First, calculate resources
        village = calculateOfflineResources(village);
        
        // Second, sync the upgrade queue
        village = await syncUpgradeQueue(village);

        res.json(village);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getWorldMap = async (req, res) => {
    try {
        // Find EVERY village in the database
        // We only select the fields needed for the map to keep it fast
        const villages = await Village.find({}, 'name ownerId x y buildings');
        
        res.json(villages);
    } catch (err) {
        res.status(500).json({ error: "The map scrolls are unreadable." });
    }
};

exports.recruitTroops = async (req, res) => {
    try {
        const { villageId, unitType, amount } = req.body;
        const village = await Village.findById(villageId);

        if (!village) return res.status(404).json({ error: "Village not found" });

        // Research requirements
        if (unitType === 'swordsman' && village.research.swordsmanLevel === 0) {
            return res.status(400).json({ error: "Research Iron Casting in Smithy first." });
        }
        if (unitType === 'archer' && village.research.archerLevel === 0) {
            return res.status(400).json({ error: "Research Composite Bows in Smithy first." });
        }

        const unitConfigs = {
            spearman: { wood: 50, clay: 30, iron: 10, time: 15 },
            swordsman: { wood: 30, clay: 50, iron: 70, time: 30 },
            archer: { wood: 60, clay: 40, iron: 20, time: 20 }
        };

        const config = unitConfigs[unitType];
        const totalWood = config.wood * amount;
        const totalClay = config.clay * amount;
        const totalIron = config.iron * amount;

        if (village.resources.wood < totalWood || village.resources.clay < totalClay || village.resources.iron < totalIron) {
            return res.status(400).json({ error: "Insufficient resources." });
        }

        // Deduct resources
        village.resources.wood -= totalWood;
        village.resources.clay -= totalClay;
        village.resources.iron -= totalIron;

        // Calculate stacked training time
        const trainingDuration = config.time * 1000 * amount;
        let startTime = Date.now();
        
        if (village.trainingQueue && village.trainingQueue.length > 0) {
            startTime = village.trainingQueue[village.trainingQueue.length - 1].finishTime;
        }
        
        const finishTime = startTime + trainingDuration;

        // Add to queue (DO NOT update village.army here)
        if (!village.trainingQueue) village.trainingQueue = [];
        village.trainingQueue.push({
            unitType,
            amount,
            finishTime
        });

        await village.save();
        res.json({ message: "Training started.", trainingQueue: village.trainingQueue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const syncTrainingQueue = async (village) => {
    const now = Date.now();
    if (!village.trainingQueue || village.trainingQueue.length === 0) return village;

    const finished = village.trainingQueue.filter(job => job.finishTime <= now);
    
    if (finished.length > 0) {
        if (!village.army) village.army = { spearman: 0, swordsman: 0, archer: 0 };

        finished.forEach(job => {
            village.army[job.unitType] = (village.army[job.unitType] || 0) + job.amount;
        });

        // Remove finished jobs from the queue
        village.trainingQueue = village.trainingQueue.filter(job => job.finishTime > now);
        
        village.markModified('army');
        village.markModified('trainingQueue');
        await village.save();
    }
    return village;
};

exports.startResearch = async (req, res) => {
    try {
        const { villageId, techName } = req.body;
        const village = await Village.findById(villageId);

        const costs = {
            swordsman: { wood: 500, clay: 500, iron: 600 },
            archer: { wood: 700, clay: 400, iron: 300 }
        };

        const cost = costs[techName];
        if (village.resources.wood < cost.wood || village.resources.iron < cost.iron) {
            return res.status(400).json({ error: "Not enough resources for research." });
        }

        village.resources.wood -= cost.wood;
        village.resources.iron -= cost.iron;
        village.research[`${techName}Level`] += 1;

        await village.save();
        res.json({ message: "Research complete!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const calculateCapacity = (level) => {
    return Math.floor(1000 * Math.pow(1.6, level));
};

const calculateOfflineResources = (village) => {
    // 1. Ensure buildings exist to prevent NaN in math
    const warehouseLvl = village.buildings?.warehouse || 1;
    const timberLvl = village.buildings?.timberCamp || 1;
    const clayLvl = village.buildings?.clayPit || 1;
    const ironLvl = village.buildings?.ironMine || 1;

    const now = new Date();
    // 2. If lastResourceUpdate is missing, use NOW so math doesn't break
    const lastUpdate = village.lastResourceUpdate ? new Date(village.lastResourceUpdate) : now;
    
    const secondsPassed = Math.floor((now - lastUpdate) / 1000);
    const capacity = Math.floor(1000 * Math.pow(1.6, warehouseLvl));

    if (secondsPassed > 0) {
        const woodRate = ((timberLvl * 20) + 2) / 3600;
        const clayRate = ((clayLvl * 20) + 2) / 3600;
        const ironRate = ((ironLvl * 15) + 1) / 3600;

        // 3. Ensure resources aren't null/undefined before adding
        village.resources.wood = Math.min(capacity, (village.resources.wood || 0) + woodRate * secondsPassed);
        village.resources.clay = Math.min(capacity, (village.resources.clay || 0) + clayRate * secondsPassed);
        village.resources.iron = Math.min(capacity, (village.resources.iron || 0) + ironRate * secondsPassed);
        
        village.lastResourceUpdate = now;
    }
    return village;
};

exports.getVillageByPlayer = async (req, res) => {
    try {
        let village = await Village.findOne({ ownerId: req.params.playerId });
        if (!village) return res.status(404).json({ error: "Village not found" });

        // 1. Calculate resource production
        village = await calculateOfflineResources(village);
        
        // 2. Process finished buildings
        village = await syncUpgradeQueue(village); 

        // 3. ADD THIS: Process finished troops
        village = await syncTrainingQueue(village); 

        village = await syncMovements(village); 

        res.json(village);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getVillageById = async (req, res) => {
    try {
        // Use findById for the specific hex ID from the URL
        let village = await Village.findById(req.params.id);
        
        if (village) {
            // Run our resource catch-up logic we built earlier
            village = calculateOfflineResources(village);
            await village.save();
            res.json(village);
        } else {
            res.status(404).json({ error: "Village not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Invalid Village ID format" });
    }
};

exports.getMyMainVillage = async (req, res) => {
    try {
        // 1. Check if cookies are actually reaching the server
        const playerId = req.cookies?.session;

        if (!playerId) {
            console.log("❌ No session cookie found in request");
            return res.status(401).json({ error: "No session found" });
        }

        // 2. Find the village
        const village = await Village.findOne({ ownerId: playerId });
        
        if (!village) {
            console.log(`❌ No village found for player: ${playerId}`);
            return res.status(404).json({ error: "Village not found" });
        }

        // 3. TEMPORARY: Bypass the sync function to test the connection
        // Once this works, we will fix the syncTrainingQueue import
        console.log(`✅ Village found: ${village.name}. Sending to frontend...`);
        res.json(village);

    } catch (err) {
        // This will print the EXACT error in your terminal
        console.error("🔥 CRITICAL SERVER ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const villages = await Village.find({});
        
        // Group by owner and calculate points
        const leaderboard = villages.reduce((acc, v) => {
            const villagePoints = Object.values(v.buildings).reduce((sum, lvl) => sum + (lvl * 10), 0);
            
            if (!acc[v.ownerId]) {
                acc[v.ownerId] = { ownerId: v.ownerId, points: 0, villages: 0 };
            }
            
            acc[v.ownerId].points += villagePoints;
            acc[v.ownerId].villages += 1;
            return acc;
        }, {});

        // Convert to array and sort by points descending
        const sorted = Object.values(leaderboard).sort((a, b) => b.points - a.points);
        
        res.json(sorted);
    } catch (err) {
        res.status(500).json({ error: "The scribes failed to tally the scores." });
    }
};

exports.getAllVillages = async (req, res) => {
    try {
        // We only need the name, coords, and owner for the map
        const villages = await Village.find({}, 'name x y ownerName');
        res.json(villages);
    } catch (err) {
        res.status(500).json({ error: "Failed to load world map." });
    }
};

const syncMovements = async (villageId) => {
    const now = new Date();
    
    const arrivals = await Movement.find({ 
        destinationId: villageId, 
        arrivalTime: { $lte: now }, 
        isCompleted: false 
    });

    for (const move of arrivals) {
        const target = await Village.findById(move.destinationId);
        const origin = await Village.findById(move.originId);

        if (!target || !origin) continue;

        // 1. Run the detailed battle engine
        const { winner, reportData } = await runBattle(move, origin, target);

        // 2. Apply Defender Casualties (Updated in runBattle, but we save here)
        target.markModified('army');
        target.markModified('resources');
        await target.save();

        // 3. Handle Attacker Loot & Survivors
        // Note: For now, loot is instant. Later, you can create a 'return' movement.
        if (winner === 'attacker') {
            origin.resources.wood += reportData.loot.wood;
            origin.resources.clay += reportData.loot.clay;
            origin.resources.iron += reportData.loot.iron;
            
            // Return surviving units to origin village immediately
            Object.keys(move.units).forEach(u => {
                origin.army[u] += (move.units[u] - reportData.attackerUnits[u].lost);
            });
            
            origin.markModified('army');
            origin.markModified('resources');
            await origin.save();
        }

        // 4. Generate the Report for the Inbox
        const Report = require('../Models/Report');
        const newReport = new Report({
            attackerId: origin.ownerId,
            defenderId: target.ownerId,
            attackerName: origin.ownerName || "Attacker",
            defenderName: target.ownerName || "Defender",
            originName: origin.name,
            targetName: target.name,
            winner,
            attackerUnits: reportData.attackerUnits,
            defenderUnits: reportData.defenderUnits,
            loot: reportData.loot
        });

        // 5. Finalize Movement
        move.isCompleted = true;
        await Promise.all([newReport.save(), move.save()]);
    }
};