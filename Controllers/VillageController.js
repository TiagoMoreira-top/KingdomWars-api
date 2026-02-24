const Village = require('../Models/Village');
const Construction = require('../Models/Construction');
const Report = require('../Models/Report');
const VillageService = require('../services/VillageService');
const World = require('../Models/World');

const BUILDINGS = require('../config/buildings');
const UNITS = require('../config/units');

exports.getConfig = async (req, res) => {
  res.status(200).json({
      success: true,
      buildings: BUILDINGS,
      units: UNITS,
    });
};

exports.getVillageData = async (req, res) => {
  try {
    const { worldId, villageId } = req.params;
    const world = req.world;

    // This service function will calculate resources and check queues
    const village = await VillageService.getUpdatedVillage(villageId, world);

    res.status(200).json({
      success: true,
      village: village,
      serverTime: Date.now()
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "⚔️ TAVERN RUMOR: Could not fetch village data." });
  }
};

exports.getMyVillages = async (req, res) => {
  try {
    const playerId = req.worldPlayer._id;

    const villages = await req.getVillageModel().find({ 
      ownerId: playerId
    })
    .select('_id name x y points') 
    .sort({ createdAt: 1 });

    const totalPoints = villages.reduce((sum, village) => {
      return sum + (village.points || 0);
    }, 0);

    // Sync the total points to the Player model for leaderboards
    await req.getWorldPlayerModel().findByIdAndUpdate(playerId, {
      points: totalPoints,
      villagesCount: villages.length
    });

    res.status(200).json({
      success: true,
      totalPoints: totalPoints,
      villages: villages
    });
  } catch (error) {
    res.status(500).json({ error: "⚔️ THE CENSUS FAILED: Thy holdings are obscured." });
  }
};

exports.upgradeBuilding = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { buildingKey } = req.body;
    const villageModel = req.getVillageModel();

    const bConfig = BUILDINGS[buildingKey];
    if (!bConfig) {
      return res.status(400).json({ error: "📜 UNKNOWN: This structure is not in the royal blueprints." });
    }

    const village = await VillageService.getUpdatedVillage(villageId, req.world);
    if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

    const queue = village.upgradeQueue || [];

    if (queue.length >= 3) {
      return res.status(403).json({ 
        error: "🔨 OVERWORKED: Thy masons are already handling 3 projects." 
      });
    }
    
    // ⚔️ LEVEL CALCULATIONS
    const queuedLevels = queue
      .filter(q => q.building === buildingKey)
      .map(q => q.targetLevel);
    
    const maxQueuedLevel = queuedLevels.length > 0 ? Math.max(...queuedLevels) : null;
    const currentLvl = (village.buildings && village.buildings[buildingKey]) || 0;
    const nextTargetLevel = maxQueuedLevel ? maxQueuedLevel + 1 : currentLvl + 1;

    if (nextTargetLevel > (bConfig.maxLevel || 30)) {
      return res.status(400).json({ error: "🏛️ PINNACLE: This structure cannot be improved further." });
    }

    // 👨‍🌾 POPULATION CHECK
    const popNeeded = bConfig.basePop ? Math.floor(bConfig.basePop * Math.pow(bConfig.popMultiplier, nextTargetLevel - 1)) : 0;
    const availablePop = village.population.habitants - village.population.used;

    if (availablePop < popNeeded) {
      return res.status(403).json({ 
        error: `👨‍🌾 OVERCROWDED: Need ${popNeeded} free citizens. Expand thy Farm!` 
      });
    }

    // 🛡️ REQUIREMENT CHECKING
    const requirements = bConfig.requirements || {};
    for (const [reqB, reqL] of Object.entries(requirements)) {
      if ((village.buildings[reqB] || 0) < reqL) {
        return res.status(403).json({ error: `📜 Foundations missing: ${reqB} (Lv. ${reqL})` });
      }
    }

    // 💰 COST CALCULATIONS
    const costMultiplierLevel = nextTargetLevel - 1;
    const woodCost = Math.floor(bConfig.baseCost.wood * Math.pow(bConfig.costMultiplier, costMultiplierLevel));
    const clayCost = Math.floor(bConfig.baseCost.clay * Math.pow(bConfig.costMultiplier, costMultiplierLevel));
    const stoneCost = Math.floor(bConfig.baseCost.stone * Math.pow(bConfig.costMultiplier, costMultiplierLevel));

    if (village.resources.wood < woodCost || village.resources.clay < clayCost || village.resources.stone < stoneCost) {
      return res.status(402).json({ error: "💰 EMPTY VAULTS: Thy coffers lack the gold for such ambition." });
    }

    // ⏳ THE STACKING CHRONOLOGY
    // Work out when the current builders will be free
    // ⏳ THE STACKING CHRONOLOGY
    const lastJobFinish = queue.length > 0 
      ? Math.max(...queue.map(q => new Date(q.finishTime).getTime()))
      : Date.now();

    // 🏛️ GREAT HALL MASTERY
    const ghConfig = BUILDINGS.greatHall;
    const ghLvl = village.buildings.greatHall || 0;
    
    // speedFactor = 1 - (level * 0.03)
    // We floor it at 0.1 so building never becomes "instant"
    const speedFactor = Math.max(0.1, 1 - (ghLvl * (ghConfig.growthFactor || 0)));

    const buildTimeSeconds = Math.max(1, Math.floor(
      bConfig.baseBuildTime * Math.pow(bConfig.timeMultiplier, costMultiplierLevel) * speedFactor
    ));

    const startTimestamp = lastJobFinish;
    const finishTimestamp = startTimestamp + (buildTimeSeconds * 1000);

    // 🏗️ DB UPDATE
    const updateResult = await villageModel.updateOne(
      { _id: villageId },
      { 
        $inc: { 
          "resources.wood": -woodCost, 
          "resources.clay": -clayCost, 
          "resources.stone": -stoneCost,
          "population.used": popNeeded
        },
        $push: {
          upgradeQueue: {
            building: buildingKey,
            targetLevel: nextTargetLevel,
            startTime: startTimestamp, // Track when the masons start
            finishTime: finishTimestamp,
            costs: {
              wood: woodCost,
              clay: clayCost,
              stone: stoneCost,
              population: popNeeded
            }
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      throw new Error("Update failed.");
    }

    res.status(200).json({
      success: true,
      message: `🏗️ ENQUEUED: ${bConfig.name} Level ${nextTargetLevel} added to the scrolls!`,
      finishTime: finishTimestamp
    });

  } catch (error) {
    console.error("Village Update Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The heavens have struck the construction site." });
  }
};

exports.cancelUpgrade = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { jobId } = req.body;
    const villageModel = req.getVillageModel();

    const village = await villageModel.findById(villageId);
    if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

    const jobIndex = village.upgradeQueue.findIndex(job => job._id.toString() === jobId);
    if (jobIndex === -1) {
      return res.status(404).json({ error: "📜 VANISHED: That project is no longer in the queue." });
    }

    const cancelledJob = village.upgradeQueue[jobIndex];
    const bConfig = BUILDINGS[cancelledJob.building];
    const cancelledLevel = cancelledJob.targetLevel;

    const { wood = 0, clay = 0, stone = 0, population = 0 } = cancelledJob.costs || {};
    
    village.upgradeQueue.splice(jobIndex, 1);

    // 🏗️ 3. THE SHIFT: Adjust all jobs that were scheduled AFTER this one
    village.upgradeQueue.forEach((job, index) => {
      // 1. DOWNSHIFT: Check if this is the same building type at a higher level
      const isSameBuildingSuccession = job.building === cancelledJob.building && job.targetLevel > cancelledLevel;
      
      if (isSameBuildingSuccession) {
        job.targetLevel -= 1;
      }

      // 2. TIMELINE RECONSTRUCTION: Only adjust jobs at or after the cancellation point
      if (index >= jobIndex) {
        const newStart = index === 0 
          ? Date.now() 
          : village.upgradeQueue[index - 1].finishTime;
        
        let durationMs;

        if (isSameBuildingSuccession) {
          // RECALCULATE: Since the level decreased, the build time must also decrease
          const bCfg = BUILDINGS[job.building];
          const newLevelForCalc = job.targetLevel - 1; // Current level is now lower
          
          const recalculatedSeconds = Math.max(1, Math.floor(
            bCfg.baseBuildTime * Math.pow(bCfg.timeMultiplier || 1.2, newLevelForCalc)
          ));
          
          durationMs = recalculatedSeconds * 1000;
        } else {
          // PRESERVE: For unrelated buildings, keep their existing duration
          durationMs = job.finishTime - job.startTime;
        }

        job.startTime = newStart;
        job.finishTime = newStart + durationMs;
      }
    });

    // 💰 4. RESTORE THE TREASURY
    village.resources.wood += wood;
    village.resources.clay += clay;
    village.resources.stone += stone;
    village.population.used = Math.max(0, village.population.used - population);

    await village.save();

    res.status(200).json({
      success: true,
      message: `⚒️ RESTRUCTURED: ${bConfig.name} work halted. The masons have moved to the next task.`,
      village
    });

  } catch (error) {
    console.error("Cancel Upgrade Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The heavens forbid halting this work." });
  }
};

exports.recruitUnits = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { unitKey, amount } = req.body;
    const villageModel = req.getVillageModel();

    const village = await villageModel.findById(villageId);
    if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

    const uConfig = UNITS[unitKey];
    if (!uConfig || amount <= 0) {
      return res.status(400).json({ error: "📜 FOLLY: Thy recruitment orders are nonsensical." });
    }

    const requirementsMet = Object.entries(uConfig.requirements || {}).every(
      ([reqB, reqL]) => (village.buildings[reqB] || 0) >= reqL
    );

    if (!requirementsMet) {
      return res.status(403).json({ error: "🏗️ FORBIDDEN: Thy village lacks the required architecture for these warriors." });
    }

    const totalWood = uConfig.baseCost.wood * amount;
    const totalClay = uConfig.baseCost.clay * amount;
    const totalStone = uConfig.baseCost.stone * amount;
    const totalPop = uConfig.population * amount;

    const hasResources = 
      village.resources.wood >= totalWood &&
      village.resources.clay >= totalClay &&
      village.resources.stone >= totalStone;

    const freePop = village.population.habitants - village.population.used;
    const hasPop = freePop >= totalPop;

    if (!hasResources || !hasPop) {
      return res.status(402).json({ error: "📉 DEPLETED: Thy coffers or thy housing cannot support such a battalion." });
    }

    let trainingBuilding = 'barracks';
    let queueKey = 'trainingQueue';

    if (uConfig.requirements?.workshop) {
      trainingBuilding = 'workshop';
      queueKey = 'workshopQueue';
    } else if (uConfig.requirements?.stable) {
      trainingBuilding = 'stable';
      queueKey = 'stableQueue';
    }

    const buildingLevel = village.buildings[trainingBuilding] || 0;
    const bConfig = BUILDINGS[trainingBuilding];
    const growthFactor = bConfig?.growthFactor || 0.1; 
    
    const speedMultiplier = 1 + (buildingLevel * growthFactor);
    const timePerUnit = uConfig.trainTime / speedMultiplier;
    const totalDuration = timePerUnit * amount;

    const now = new Date();
    let startTime;

    const activeQueue = village[queueKey] || [];

    if (activeQueue.length > 0) {
      const lastJob = activeQueue[activeQueue.length - 1];
      const lastFinish = new Date(lastJob.finishTime);
      startTime = lastFinish < now ? now : lastFinish;
    } else {
      startTime = now;
    }

    const finishTime = new Date(startTime.getTime() + totalDuration * 1000);

    village.resources.wood -= totalWood;
    village.resources.clay -= totalClay;
    village.resources.stone -= totalStone;
    village.population.used += totalPop;

    if (!village[queueKey]) village[queueKey] = [];

    village[queueKey].push({
      unitKey,
      amount,
      unitsLeft: amount,
      startTime,
      finishTime,
      timePerUnit: timePerUnit * 1000,
      lastUpdate: startTime,
      totalDuration,
      costs: {
        wood: totalWood,
        clay: totalClay,
        stone: totalStone,
        population: totalPop
      }
    });

    await village.save();

    res.status(200).json({
      success: true,
      message: `⚔️ MUSTERED: ${amount} ${uConfig.name} have been added to the ${trainingBuilding} grounds.`,
      village
    });

  } catch (error) {
    console.error("Recruitment Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The forge fires have died unexpectedly." });
  }
};

exports.cancelRecruitment = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { jobId } = req.body;
    const villageModel = req.getVillageModel();

    let village = await villageModel.findById(villageId);
    if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

    // 🔥 PRE-SURGERY TICK: Process any units finished in the last few seconds
    village = await VillageService.getUpdatedVillage(villageId, req.world); 

    // 🕵️ Find which queue holds the job
    const queueKeys = ['trainingQueue', 'stableQueue', 'workshopQueue'];
    let foundQueueKey = null;
    let jobIndex = -1;

    for (const key of queueKeys) {
      const idx = village[key].findIndex(j => j._id.toString() === jobId);
      if (idx !== -1) {
        foundQueueKey = key;
        jobIndex = idx;
        break;
      }
    }

    if (!foundQueueKey) {
      return res.status(404).json({ error: "📜 VANISHED: This order is no longer in the scrolls." });
    }

    const activeQueue = village[foundQueueKey];
    const job = activeQueue[jobIndex];
    const uConfig = UNITS[job.unitKey];

    // 💰 1. THE REBATE (Calculated only on remaining units)
    const refundFactor = 0.9; 
    const unitsToRefund = job.unitsLeft;

    if (unitsToRefund > 0) {
      village.resources.wood += Math.floor((uConfig.baseCost.wood || 0) * unitsToRefund * refundFactor);
      village.resources.clay += Math.floor((uConfig.baseCost.clay || 0) * unitsToRefund * refundFactor);
      village.resources.stone += Math.floor((uConfig.baseCost.stone || 0) * unitsToRefund * refundFactor);
      
      village.population.used = Math.max(0, village.population.used - (uConfig.population * unitsToRefund));
    }

    // ⚔️ 2. THE REMOVAL
    const wasFirst = jobIndex === 0;
    activeQueue.splice(jobIndex, 1);

    // ⏳ 3. THE CHAIN REPAIR (Specific to this queue only)
    let runningTimestamp = Date.now();

    activeQueue.forEach((item, index) => {
      const itemConfig = UNITS[item.unitKey];
      
      // Determine building for this specific queue
      const trainingBuilding = foundQueueKey === 'stableQueue' ? 'stable' : 
                               foundQueueKey === 'workshopQueue' ? 'workshop' : 'barracks';
                               
      const buildingLevel = village.buildings[trainingBuilding] || 0;
      const bConfig = BUILDINGS[trainingBuilding];
      const speedMultiplier = 1 + (buildingLevel * (bConfig?.growthFactor || 0.1));
      
      const msPerUnit = (itemConfig.trainTime / speedMultiplier) * 1000;
      const totalRemainingMs = msPerUnit * item.unitsLeft;

      if (index === 0 && !wasFirst) {
        // If we didn't remove the first item, the new first item stays on its current course
        runningTimestamp = new Date(item.finishTime).getTime();
      } else {
        // Shift this job forward to fill the gap
        const newStart = runningTimestamp;
        const newFinish = newStart + totalRemainingMs;
        
        item.startTime = new Date(newStart);
        item.finishTime = new Date(newFinish);
        item.lastUpdate = new Date(newStart);
        
        runningTimestamp = newFinish;
      }
    });

    village.markModified(foundQueueKey);
    village.markModified('resources');
    village.markModified('population');
    await village.save();

    res.status(200).json({
      success: true,
      message: `🕊️ DISSOLVED: The order for ${unitsToRefund} warriors was halted. Resources returned.`,
      village
    });

  } catch (error) {
    console.error("Cancel Recruitment Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The heavens forbid halting this work." });
  }
};

exports.renameVillage = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { name } = req.body;
    const villageModel = req.getVillageModel();

    // ⚔️ 1. Validation: Ensure the name is worthy of a fiefdom
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ 
        error: "📜 REJECTED: A village name must be at least 3 characters long." 
      });
    }

    if (name.length > 20) {
      return res.status(400).json({ 
        error: "📜 REJECTED: That title is too long for our maps and scrolls." 
      });
    }

    // ⚔️ 2. Locate the territory
    let village = await villageModel.findById(villageId);
    if (!village) {
      return res.status(404).json({ 
        error: "🏰 MYSTERY: This land is not on our maps." 
      });
    }

    // ⚔️ 3. Ownership Check (Assuming req.worldPlayer exists from your auth middleware)
    if (village.ownerId.toString() !== req.worldPlayer._id.toString()) {
      return res.status(403).json({ 
        error: "⚔️ TREASON: Thou cannot rename a land that is not thine own!" 
      });
    }

    // ⚔️ 4. The Rechristening
    const oldName = village.name;
    village.name = name.trim();

    // In some setups, simple strings don't need markModified, 
    // but it's safer to include it given your complex schema.
    village.markModified('name');
    await village.save();

    res.status(200).json({
      success: true,
      message: `📜 DECREE: ${oldName} shall henceforth be known as ${village.name}.`,
      newName: village.name
    });

  } catch (error) {
    console.error("Rename Village Error:", error);
    res.status(500).json({ 
      error: "⚡ OMEN: The scribes have run out of ink; the name remains unchanged." 
    });
  }
};

exports.sendMission = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { targetX, targetY, units, type } = req.body;
    
    const villageModel = req.getVillageModel();
    const missionModel = req.getMissionModel();

    // 1. 🏰 GATHER INTELLIGENCE
    let originVillage = await villageModel.findOne({ 
      _id: villageId, 
      ownerId: req.worldPlayer._id 
    });

    if (!originVillage) {
      return res.status(404).json({ error: "🏰 MYSTERY: Thy home keep is not found on the scrolls." });
    }

    originVillage = await VillageService.getUpdatedVillage(originVillage._id, req.world);

    const targetVillage = await villageModel.findOne({ x: targetX, y: targetY });
    if (!targetVillage) {
      return res.status(404).json({ error: "🗺️ UNKNOWN: Those coordinates lead to a bottomless abyss." });
    }

    if (originVillage.x === targetX && originVillage.y === targetY) {
      return res.status(400).json({ error: "⚔️ FOLLY: Thou cannot lay siege to thy own gates!" });
    }

    // 2. 🛡️ INSPECT THE HOST
    let slowestSpeed = 0;
    const unitsToMarch = {};

    for (const [unitKey, count] of Object.entries(units)) {
      const numCount = Math.floor(Number(count) || 0);
      if (numCount <= 0) continue;

      const available = originVillage.army[unitKey] || 0;
      if (numCount > available) {
        return res.status(400).json({ error: `⚔️ DESERTION: Not enough units in the garrison for such a march!` });
      }

      const uConfig = UNITS[unitKey];
      if (uConfig) {
        slowestSpeed = Math.max(slowestSpeed, uConfig.speed);
        unitsToMarch[unitKey] = numCount;
      }
    }

    if (Object.keys(unitsToMarch).length === 0) {
      return res.status(400).json({ error: "⚔️ EMPTY: Thou cannot send a ghost army to do a man's work." });
    }

    // 3. 🗺️ CHART THE COURSE
    const dist = Math.sqrt(Math.pow(targetX - originVillage.x, 2) + Math.pow(targetY - originVillage.y, 2));
    const travelMinutes = Math.round(dist * slowestSpeed);
    const arrivalTime = new Date(Date.now() + travelMinutes * 60000);

    // 4. 📜 INSCRIBE THE MARCH
    const mission = new missionModel({
      type, 
      originVillage: originVillage._id,
      // 📍 NEW: Storing the origin coordinates so the host can find their way home
      originCoords: { x: originVillage.x, y: originVillage.y },
      targetVillage: targetVillage._id,
      targetCoords: { x: targetX, y: targetY },
      lord: req.worldPlayer._id,
      units: unitsToMarch,
      departureTime: new Date(),
      arrivalTime,
      status: 'marching'
    });

    // ⚔️ THE CONNECTION
    originVillage.outgoingMissions.push(mission._id);
    targetVillage.incomingMissions.push(mission._id);

    for (const [unitKey, count] of Object.entries(unitsToMarch)) {
      originVillage.army[unitKey] -= count;
    }

    originVillage.markModified('army');
    originVillage.markModified('outgoingMissions');
    targetVillage.markModified('incomingMissions');

    // 5. 📉 COMMIT
    await Promise.all([
      mission.save(),
      originVillage.save(),
      targetVillage.save()
    ]);

    res.status(201).json({
      success: true,
      message: type === 'attack' ? "⚔️ TO WAR: Thy banners are raised!" : "🛡️ AID: Thy host marches to support our allies!",
      mission,
      village: originVillage
    });

  } catch (error) {
    console.error("Send Mission Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The heavens forbid this march. The messenger has fallen." });
  }
};