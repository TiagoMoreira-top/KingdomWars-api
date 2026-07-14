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

    const { getPerkMultipliers } = require('../config/kingPerks');
    const perkMults = getPerkMultipliers(req.worldPlayer.kingLevel || 1);
    const perkSpeedFactor = Math.max(0.1, speedFactor * (1 - perkMults.buildTimeReduction));

    const buildTimeSeconds = Math.max(1, Math.floor(
      bConfig.baseBuildTime * Math.pow(bConfig.timeMultiplier, costMultiplierLevel) * perkSpeedFactor
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

exports.recruitUnits = async (req, res) =>
{
    try
    {
        const { villageId } = req.params;
        const { unitKey, amount } = req.body;
        const villageModel = req.getVillageModel();

        const village = await villageModel.findById(villageId);
        if (!village)
        {
            return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });
        }

        const uConfig = UNITS[unitKey];
        if (!uConfig || amount <= 0)
        {
            return res.status(400).json({ error: "📜 FOLLY: Thy recruitment orders are nonsensical." });
        }

        const requirementsMet = Object.entries(uConfig.requirements || {}).every(
            ([reqB, reqL]) => (village.buildings[reqB] || 0) >= reqL
        );

        if (!requirementsMet)
        {
            return res.status(403).json({ error: "🏗️ FORBIDDEN: Thy village lacks the required architecture for these warriors." });
        }

        // 💰 Calculate Costs (Added Gold support for Palace units)
        const totalWood = (uConfig.baseCost.wood || 0) * amount;
        const totalClay = (uConfig.baseCost.clay || 0) * amount;
        const totalStone = (uConfig.baseCost.stone || 0) * amount;
        const totalGold = (uConfig.baseCost.gold || 0) * amount;
        const totalPop = (uConfig.population || 0) * amount;

        const hasResources =
            village.resources.wood >= totalWood &&
            village.resources.clay >= totalClay &&
            village.resources.stone >= totalStone &&
            (village.resources.gold || 0) >= totalGold;

        const freePop = village.population.habitants - village.population.used;
        const hasPop = freePop >= totalPop;

        if (!hasResources || !hasPop)
        {
            return res.status(402).json({ error: "📉 DEPLETED: Thy coffers or thy housing cannot support such a battalion." });
        }

        // 🏗️ Determine Training Building and Queue
        let trainingBuilding = 'barracks';
        let queueKey = 'trainingQueue';

        if (uConfig.requirements?.palace)
        {
            trainingBuilding = 'palace';
            queueKey = 'palaceQueue';
        }
        else if (uConfig.requirements?.workshop)
        {
            trainingBuilding = 'workshop';
            queueKey = 'workshopQueue';
        }
        else if (uConfig.requirements?.stable)
        {
            trainingBuilding = 'stable';
            queueKey = 'stableQueue';
        }

        const buildingLevel = village.buildings[trainingBuilding] || 0;
        const bConfig = BUILDINGS[trainingBuilding];
        const growthFactor = bConfig?.growthFactor || 0.1;

        const speedMultiplier = 1 + (buildingLevel * growthFactor);
        const timePerUnit = uConfig.trainTime / speedMultiplier;
        const totalDuration = timePerUnit * amount;

        // ⏳ Calculate Timing
        const now = new Date();
        let startTime;

        if (!village[queueKey])
        {
            village[queueKey] = [];
        }

        const activeQueue = village[queueKey];

        if (activeQueue.length > 0)
        {
            const lastJob = activeQueue[activeQueue.length - 1];
            const lastFinish = new Date(lastJob.finishTime);
            // If the last job finished in the past but hasn't been "ticked" yet, 
            // the new job starts from now. Otherwise, it appends to the end.
            startTime = lastFinish < now ? now : lastFinish;
        }
        else
        {
            startTime = now;
        }

        const finishTime = new Date(startTime.getTime() + totalDuration * 1000);

        // 💸 Deduct Resources
        village.resources.wood -= totalWood;
        village.resources.clay -= totalClay;
        village.resources.stone -= totalStone;
        if (totalGold > 0) village.resources.gold -= totalGold;
        village.population.used += totalPop;

        // 📝 Add to Queue
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
                gold: totalGold,
                population: totalPop
            }
        });

        // Ensure MongoDB detects the change in the dynamic queue array
        village.markModified(queueKey);
        village.markModified('resources');
        village.markModified('population');

        await village.save();

        res.status(200).json({
            success: true,
            message: `⚔️ MUSTERED: ${amount} ${uConfig.name} have been added to the ${trainingBuilding} grounds.`,
            village
        });
    }
    catch (error)
    {
        console.error("Recruitment Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The forge fires have died unexpectedly." });
    }
};

exports.cancelRecruitment = async (req, res) =>
{
    try
    {
        const { villageId } = req.params;
        const { jobId } = req.body;
        const villageModel = req.getVillageModel();

        let village = await villageModel.findById(villageId);
        if (!village) 
        {
            return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });
        }

        // 🔥 PRE-SURGERY TICK: Process any units finished in the last few seconds
        village = await VillageService.getUpdatedVillage(villageId, req.world);

        // 🕵️ Find which queue holds the job (Added palaceQueue here)
        const queueKeys = ['trainingQueue', 'stableQueue', 'workshopQueue', 'palaceQueue'];
        let foundQueueKey = null;
        let jobIndex = -1;

        for (const key of queueKeys)
        {
            const idx = village[key].findIndex(j => j._id.toString() === jobId);
            if (idx !== -1)
            {
                foundQueueKey = key;
                jobIndex = idx;
                break;
            }
        }

        if (!foundQueueKey)
        {
            return res.status(404).json({ error: "📜 VANISHED: This order is no longer in the scrolls." });
        }

        const activeQueue = village[foundQueueKey];
        const job = activeQueue[jobIndex];
        const uConfig = UNITS[job.unitKey];

        // 💰 1. THE REBATE (Calculated only on remaining units)
        const refundFactor = 0.9;
        const unitsToRefund = job.unitsLeft;

        if (unitsToRefund > 0)
        {
            village.resources.wood += Math.floor((uConfig.baseCost.wood || 0) * unitsToRefund * refundFactor);
            village.resources.clay += Math.floor((uConfig.baseCost.clay || 0) * unitsToRefund * refundFactor);
            village.resources.stone += Math.floor((uConfig.baseCost.stone || 0) * unitsToRefund * refundFactor);
            village.resources.gold += Math.floor((uConfig.baseCost.gold || 0) * unitsToRefund * refundFactor);

            village.population.used = Math.max(0, village.population.used - (uConfig.population * unitsToRefund));
        }

        // ⚔️ 2. THE REMOVAL
        const wasFirst = jobIndex === 0;
        activeQueue.splice(jobIndex, 1);

        // ⏳ 3. THE CHAIN REPAIR (Recalculate timestamps for the remaining items)
        let runningTimestamp = Date.now();

        activeQueue.forEach((item, index) =>
        {
            const itemConfig = UNITS[item.unitKey];

            // Determine building for this specific queue
            let trainingBuilding = 'barracks';
            if (foundQueueKey === 'stableQueue') trainingBuilding = 'stable';
            if (foundQueueKey === 'workshopQueue') trainingBuilding = 'workshop';
            if (foundQueueKey === 'palaceQueue') trainingBuilding = 'palace';

            const buildingLevel = village.buildings[trainingBuilding] || 0;
            const bConfig = BUILDINGS[trainingBuilding];
            
            // Standardizing speed calculation
            const growthFactor = bConfig?.growthFactor || 0.1;
            const speedMultiplier = 1 + (buildingLevel * growthFactor);

            const msPerUnit = (itemConfig.trainTime / speedMultiplier) * 1000;
            const totalRemainingMs = msPerUnit * item.unitsLeft;

            if (index === 0 && !wasFirst)
            {
                // If we didn't remove the first item, it keeps its current completion track
                runningTimestamp = new Date(item.finishTime).getTime();
            }
            else
            {
                // Shift this job forward to fill the gap created by cancellation
                const newStart = runningTimestamp;
                const newFinish = newStart + totalRemainingMs;

                item.startTime = new Date(newStart);
                item.finishTime = new Date(newFinish);
                item.lastUpdate = new Date(newStart);
                item.timePerUnit = msPerUnit; // Store the updated speed

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
    }
    catch (error)
    {
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
    if (!targetVillage && type !== 'scout') {
      return res.status(404).json({ error: "🗺️ UNKNOWN: Those coordinates lead to a bottomless abyss." });
    }
    if (type === 'scout' && !targetVillage) {
      return res.status(404).json({ error: "🗺️ UNKNOWN: There is no settlement to scout at those coordinates." });
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

    // Track mission launch stat
    try {
      const WPModel = req.getWorldPlayerModel();
      await WPModel.updateOne({ _id: req.worldPlayer._id }, { $inc: { 'stats.missionsLaunched': 1, kingXP: 5 } });
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: type === 'attack' ? "⚔️ TO WAR: Thy banners are raised!" : type === 'scout' ? "🔍 SHADOWS: Thy scouts slip through the darkness!" : "🛡️ AID: Thy host marches to support our allies!",
      mission,
      village: originVillage
    });

  } catch (error) {
    console.error("Send Mission Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The heavens forbid this march. The messenger has fallen." });
  }
};

exports.buySlaves = async (req, res) => 
{
    try 
    {
        const { villageId } = req.params;
        const { amount } = req.body; 
        const villageModel = req.getVillageModel();

        const village = await villageModel.findById(villageId);
        if (!village) 
        {
            return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });
        }

        const uConfig = UNITS['common_slave'];
        if (!uConfig || amount <= 0) 
        {
            return res.status(400).json({ error: "📜 FOLLY: Thy slave orders are nonsensical." });
        }

        // 🏗️ Check if Arena exists
        const arenaLevel = village.buildings.arena || 0;
        if (arenaLevel < 1) 
        {
            return res.status(403).json({ error: "🏗️ FORBIDDEN: Thou must build an Arena to house slaves." });
        }

        // 💰 Cost Calculation
        const totalGold = uConfig.baseCost.gold * amount;
        const totalPop = uConfig.population * amount;

        const hasGold = (village.resources.gold || 0) >= totalGold;
        const freePop = village.population.habitants - village.population.used;
        const hasPop = freePop >= totalPop;

        if (!hasGold || !hasPop) 
        {
            return res.status(402).json({ error: "📉 DEPLETED: Thy treasury is empty or thy housing is full." });
        }

        // ✍️ Instant Update State
        // 1. Deduct Resources
        village.resources.gold -= totalGold;
        village.population.used += totalPop;

        // 2. Immediate Delivery to Army
        if (!village.army) 
        {
            village.army = {};
        }
        
        village.army['common_slave'] = (village.army['common_slave'] || 0) + amount;

        // 3. Persist Changes
        // Use markModified if army is a Mixed type/Schema-less sub-document
        village.markModified('army');
        village.markModified('resources');
        village.markModified('population');
        
        await village.save();

        res.status(200).json({
            success: true,
            message: `⛓️ ACQUIRED: ${amount} Slaves have entered the Arena pits.`,
            village
        });

    } 
    catch (error) 
    {
        console.error("Slave Purchase Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The slave traders have vanished into the mist." });
    }
};

// ⛪ CHURCH — HOLD MASS
exports.holdMass = async (req, res) => {
    try {
        const { villageId } = req.params;
        const villageModel = req.getVillageModel();
        const village = await villageModel.findById(villageId);
        if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

        const churchLevel = village.buildings.church || 0;
        if (churchLevel < 1) return res.status(403).json({ error: "⛪ FORBIDDEN: Thou must build a Church first." });

        // Cooldown: 1 hour between masses
        const COOLDOWN_MS = 60 * 60 * 1000;
        if (village.lastMassTime && (Date.now() - new Date(village.lastMassTime).getTime()) < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(village.lastMassTime).getTime())) / 60000);
            return res.status(429).json({ error: `⛪ TOO SOON: The faithful need rest. Try again in ${remaining} minute(s).` });
        }

        // Cost scales with level
        const costs = { gold: 300 * churchLevel, wood: 100 * churchLevel, clay: 50 * churchLevel, stone: 150 * churchLevel };
        if ((village.resources.gold || 0) < costs.gold || village.resources.wood < costs.wood ||
            village.resources.clay < costs.clay || village.resources.stone < costs.stone) {
            return res.status(402).json({ error: "💰 EMPTY VAULTS: Thy coffers lack the offerings for this ceremony." });
        }

        // Loyalty gain: +5 per church level, capped at 100
        const loyaltyGain = 5 * churchLevel;
        village.loyalty = Math.min(100, (village.loyalty || 0) + loyaltyGain);
        village.resources.gold  -= costs.gold;
        village.resources.wood  -= costs.wood;
        village.resources.clay  -= costs.clay;
        village.resources.stone -= costs.stone;
        village.lastMassTime = new Date();

        village.markModified('resources');
        await village.save();

        res.status(200).json({
            success: true,
            message: `⛪ BLESSED: The faithful have gathered. Loyalty increased by ${loyaltyGain}.`,
            loyalty: village.loyalty,
            village
        });
    } catch (error) {
        console.error("Hold Mass Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The heavens did not answer the prayers." });
    }
};

// 🐉 DRAGON'S PIT — HATCH DRAGON
exports.hatchDragon = async (req, res) => {
    try {
        const { villageId } = req.params;
        const { name, type, fromEgg } = req.body;
        const villageModel = req.getVillageModel();
        const DragonModel = req.getDragonModel();

        const village = await villageModel.findById(villageId).populate('dragons');
        if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

        const pitLevel = village.buildings.dragonsPit || 0;
        if (pitLevel < 1) return res.status(403).json({ error: "🐉 FORBIDDEN: Thou must build a Dragon's Pit first." });

        if ((village.dragons || []).length >= pitLevel) {
            return res.status(403).json({ error: `🐉 FULL: Thy pit can only house ${pitLevel} dragon(s). Upgrade the pit to hatch more.` });
        }

        if (!name || name.trim().length < 2) return res.status(400).json({ error: "✍️ Every dragon must have a name." });
        const validTypes = ['Emberwing', 'Frostwing', 'Stormwing'];
        if (!validTypes.includes(type)) return res.status(400).json({ error: "📜 Unknown dragon bloodline." });

        if (fromEgg) {
            // Egg hatch: free but village must have an egg
            if (!village.dragonEgg) {
                return res.status(400).json({ error: "🥚 NO EGG: Thy vault holds no dragon egg." });
            }
            // Consume the egg
            const DragonEggModel = req.getDragonEggModel();
            await DragonEggModel.findByIdAndDelete(village.dragonEgg);
            village.dragonEgg = null;
        } else {
            // Normal hatch cost
            const cost = { wood: 5000, clay: 3000, stone: 8000, gold: 5000 };
            if ((village.resources.gold || 0) < cost.gold || village.resources.wood < cost.wood ||
                village.resources.clay < cost.clay || village.resources.stone < cost.stone) {
                return res.status(402).json({ error: "💰 INSUFFICIENT: Hatching a dragon demands great tribute." });
            }
            village.resources.gold  -= cost.gold;
            village.resources.wood  -= cost.wood;
            village.resources.clay  -= cost.clay;
            village.resources.stone -= cost.stone;
            village.markModified('resources');
        }

        const BASE = { Emberwing: { health: 150, attack: 80, defense: 20, breathDamage: 100 },
                        Frostwing:  { health: 250, attack: 30, defense: 90, breathDamage:  40 },
                        Stormwing:  { health: 200, attack: 60, defense: 60, breathDamage:  70 } };
        const stats = BASE[type];

        // Egg hatch is faster (1 hour), normal hatch is 4 hours
        const hatchUntil = new Date(Date.now() + (fromEgg ? 1 : 4) * 60 * 60 * 1000);

        const dragon = new DragonModel({
            villageId: village._id,
            ownerId: village.ownerId,
            name: name.trim(),
            type,
            status: 'Hatching',
            level: 1,
            hatchUntil,
            ...stats,
            maxHealth: stats.health
        });

        await dragon.save();

        village.dragons.push(dragon._id);
        await village.save();
        await village.populate('dragons');

        try {
            const WPModel = req.getWorldPlayerModel();
            await WPModel.updateOne({ _id: village.ownerId }, { $inc: { 'stats.dragonsHatched': 1, kingXP: 100 } });
        } catch (_) {}

        res.status(201).json({
            success: true,
            message: fromEgg ? `🥚 EGG HATCHING: ${name} begins to stir — the ancient egg cracks open!` : `🐉 HATCHING: ${name} stirs within the egg. The wait begins.`,
            dragon,
            village
        });
    } catch (error) {
        console.error("Hatch Dragon Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The egg has cracked before its time." });
    }
};

// 🐉 DRAGON'S PIT — TRAIN DRAGON
exports.trainDragon = async (req, res) => {
    try {
        const { villageId } = req.params;
        const { dragonId } = req.body;
        const villageModel = req.getVillageModel();
        const DragonModel = req.getDragonModel();

        const village = await villageModel.findById(villageId);
        if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

        const dragon = await DragonModel.findById(dragonId);
        if (!dragon || dragon.villageId.toString() !== villageId) {
            return res.status(404).json({ error: "🐉 LOST: That dragon is not of this lair." });
        }

        if (dragon.status !== 'Idle') return res.status(400).json({ error: "🐉 BUSY: This dragon is already occupied." });

        const MAX_DRAGON_LEVEL = 10;
        if (dragon.level >= MAX_DRAGON_LEVEL) return res.status(400).json({ error: "🐉 PEAK: This dragon has reached its full might." });

        const cost = { gold: dragon.level * 2000, wood: dragon.level * 500, clay: dragon.level * 300, stone: dragon.level * 800 };
        if ((village.resources.gold || 0) < cost.gold || village.resources.wood < cost.wood ||
            village.resources.clay < cost.clay || village.resources.stone < cost.stone) {
            return res.status(402).json({ error: "💰 IMPOVERISHED: Thy reserves cannot sustain such rigorous training." });
        }

        village.resources.gold  -= cost.gold;
        village.resources.wood  -= cost.wood;
        village.resources.clay  -= cost.clay;
        village.resources.stone -= cost.stone;
        village.markModified('resources');
        await village.save();

        // Training duration: level * 2 hours
        dragon.status = 'Training';
        dragon.trainingUntil = new Date(Date.now() + dragon.level * 2 * 60 * 60 * 1000);
        await dragon.save();

        await village.populate('dragons');

        res.status(200).json({
            success: true,
            message: `🐉 TRAINING: ${dragon.name} breathes fire and hones its fury.`,
            dragon,
            village
        });
    } catch (error) {
        console.error("Train Dragon Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The training grounds have collapsed." });
    }
};

exports.ascendToGladiator = async (req, res) =>
{
    try
    {
        const { villageId } = req.params;
        const { gladiatorName, type } = req.body;
        
        const villageModel = req.getVillageModel();
        const gladiatorModel = req.getGladiatorModel();

        const village = await villageModel.findById(villageId);
        if (!village)
        {
            return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });
        }

        // 1. Check if we have slaves ready
        if (!village.army || (village.army.common_slave || 0) < 1)
        {
            return res.status(400).json({ error: "📜 FOLLY: There are no slaves in thy pits to ascend." });
        }

        // 2. Validate Name
        if (!gladiatorName || gladiatorName.trim().length < 2)
        {
            return res.status(400).json({ error: "✍️ ERROR: Every legend must have a name." });
        }

        // 3. Determine Starting Battle Points
        let startingBP = 10;
        if (type === 'Murmillo') startingBP = 15;
        if (type === 'Retiarius') startingBP = 12;

        const gladiatorData = {
            villageId: village._id,
            ownerId: village.ownerId,
            name: gladiatorName.trim(),
            type: type || 'Murmillo',
            status: 'Idle',
            level: 1,
            experience: 0,
            battlePoints: startingBP,
            health: 100,
            maxHealth: 100,
            wins: 0,
            losses: 0
        };

        // 4. Create the Gladiator document
        const newGladiator = new gladiatorModel(gladiatorData);

        await newGladiator.save();

        // 5. LINK TO VILLAGE: This is the missing step!
        // We push the new ID into the gladiators array we added to the schema
        if (!village.gladiators) village.gladiators = [];
        village.gladiators.push(newGladiator._id);

        // 6. Consume the Slave
        village.army.common_slave -= 1;
        village.markModified('army');

        // 7. Save Village
        await village.save();

        // 8. POPULATE: Ensure the response contains the full gladiator objects, not just IDs
        await village.populate('gladiators');

        res.status(201).json({
            success: true,
            message: `👑 ASCENDED: ${gladiatorName} has risen from the pits!`,
            gladiator: newGladiator,
            village: village // Now contains the populated gladiators array
        });
    }
    catch (error)
    {
        console.error("Ascension Error:", error);
        res.status(500).json({ error: "⚡ OMEN: The gods refuse this sacrifice." });
    }
};

exports.recoverWounded = async (req, res) => {
  try {
    const { villageId } = req.params;
    const villageModel = req.getVillageModel();

    const village = await villageModel.findById(villageId);
    if (!village) return res.status(404).json({ error: '🏰 MYSTERY: Village not found.' });

    if (village.ownerId.toString() !== req.worldPlayer._id.toString()) {
      return res.status(403).json({ error: '⚔️ TREASON: Not thy village.' });
    }

    if (village.buildings.hospital < 1) {
      return res.status(403).json({ error: '🏥 FORBIDDEN: Build a Hospital first.' });
    }

    const wounded = village.army.wounded;
    if (!wounded) return res.status(400).json({ error: '🏥 EMPTY: No wounded soldiers to treat.' });

    const UNIT_KEYS = ['serf_levy','man_at_arms','longbowman','spearman','swordsman','archer',
      'palfrey_messenger','gilded_knight','light_knight','ram','catapult'];

    let totalRecovered = 0;
    for (const key of UNIT_KEYS) {
      const count = wounded[key] || 0;
      if (count > 0) {
        village.army[key] = (village.army[key] || 0) + count;
        village.army.wounded[key] = 0;
        totalRecovered += count;
      }
    }

    if (totalRecovered === 0) {
      return res.status(400).json({ error: '🏥 EMPTY: No wounded soldiers to treat.' });
    }

    village.markModified('army');
    await village.save();

    // Small XP reward for using hospital
    try {
      const WPModel = req.getWorldPlayerModel();
      await WPModel.updateOne({ _id: req.worldPlayer._id }, { $inc: { kingXP: Math.floor(totalRecovered / 5) } });
    } catch (_) {}

    res.status(200).json({
      success: true,
      message: `🏥 HEALED: ${totalRecovered} soldiers have returned to thy host!`,
      village
    });
  } catch (error) {
    console.error('Recover Wounded Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The surgeons have failed.' });
  }
};

exports.conquerVillage = async (req, res) => {
  try {
    const { villageId, worldId } = req.params;
    const { targetVillageId } = req.body;

    if (!targetVillageId) {
      return res.status(400).json({ error: '⚔️ MISSING: No target village specified.' });
    }

    const villageModel = req.getVillageModel();
    const wpModel = req.getWorldPlayerModel();

    // Load attacker's village (must own it)
    const attackerVillage = await villageModel.findOne({ _id: villageId, ownerId: req.worldPlayer._id });
    if (!attackerVillage) {
      return res.status(403).json({ error: '⚔️ TREASON: This is not thy village.' });
    }

    // Load target village
    const targetVillage = await villageModel.findById(targetVillageId);
    if (!targetVillage) {
      return res.status(404).json({ error: '🏰 MYSTERY: That village no longer exists.' });
    }

    // Cannot conquer own village or already conquered
    if (targetVillage.ownerId.toString() === req.worldPlayer._id.toString()) {
      return res.status(400).json({ error: '⚔️ FOLLY: Thou already own this land.' });
    }

    // Check that defender's army is fully defeated (0 active troops)
    const armyKeys = ['serf_levy','man_at_arms','longbowman','spearman','swordsman','archer',
      'palfrey_messenger','gilded_knight','light_knight','ram','catapult','noble','common_slave'];
    const defenderStrength = armyKeys.reduce((s, k) => s + (targetVillage.army[k] || 0), 0);
    if (defenderStrength > 0) {
      return res.status(400).json({ error: '⚔️ RESISTANCE: The village still defends itself. Crush them first!' });
    }

    const prevOwnerId = targetVillage.ownerId;
    const attackerName = req.worldPlayer.username;

    // Transfer ownership
    targetVillage.ownerId = req.worldPlayer._id;
    targetVillage.ownerName = attackerName;
    targetVillage.name = `${attackerName}'s Conquest`;

    // Clear reinforcements (they belonged to the old owner's allies)
    targetVillage.reinforcements = [];
    targetVillage.markModified('reinforcements');

    await targetVillage.save();

    // Update WorldPlayer records
    await Promise.all([
      wpModel.updateOne({ _id: req.worldPlayer._id }, { $inc: { villagesCount: 1, kingXP: 200 } }),
      wpModel.updateOne({ _id: prevOwnerId }, { $inc: { villagesCount: -1 } }),
    ]);

    // Recompute king level for conqueror
    const conquerer = await wpModel.findById(req.worldPlayer._id).select('kingXP').lean();
    if (conquerer) {
      const newLevel = Math.min(20, Math.floor(Math.sqrt(conquerer.kingXP / 100)) + 1);
      await wpModel.updateOne({ _id: req.worldPlayer._id }, { kingLevel: newLevel });
    }

    res.status(200).json({
      success: true,
      message: `⚔️ CONQUEST: ${targetVillage.name} now bows to thy banner!`,
      village: targetVillage
    });

  } catch (error) {
    console.error('Conquer Village Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The conquest was repelled by dark forces.' });
  }
};