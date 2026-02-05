const Village = require('../Models/Village');
const { calculateResources } = require('../utils/functions');
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
    res.status(500).json({ error: "⚔️ TAVERN RUMOR: Could not fetch village data." });
  }
};

exports.getMyVillages = async (req, res) => {
  try {
    const playerId = req.worldPlayer._id;

    // We find all villages where the player is the master
    const villages = await req.getVillageModel().find({ 
      ownerId: playerId
    })
    .select('_id name x y') 
    .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
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
    // Calculate how much labor this specific level-up requires
    if (bConfig.basePop) {
      const popNeededForNextLevel = Math.floor(
        bConfig.basePop * Math.pow(bConfig.popMultiplier, nextTargetLevel - 1)
      );
      
      const availablePop = village.population.habitants - village.population.used;

      if (availablePop < popNeededForNextLevel) {
        return res.status(403).json({ 
          error: `👨‍🌾 OVERCROWDED: Need ${popNeededForNextLevel} free citizens, but only ${availablePop} are idle. Expand thy Farm!` 
        });
      }
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

    // ⏳ PARALLEL TIME
    const buildTimeSeconds = Math.floor(bConfig.baseBuildTime * Math.pow(bConfig.timeMultiplier, costMultiplierLevel));
    const finishTime = Date.now() + (buildTimeSeconds * 1000);

    // 🏗️ DB UPDATE
    const updateResult = await villageModel.updateOne(
      { _id: villageId },
      { 
        $inc: { 
          "resources.wood": -woodCost, 
          "resources.clay": -clayCost, 
          "resources.stone": -stoneCost,
          "population.used": bConfig.basePop ? Math.floor(bConfig.basePop * Math.pow(bConfig.popMultiplier, nextTargetLevel - 1)) : 0
        },
        $push: {
          upgradeQueue: {
            building: buildingKey,
            targetLevel: nextTargetLevel,
            finishTime: finishTime
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      throw new Error("Update failed: Village not modified.");
    }

    res.status(200).json({
      success: true,
      message: `🏗️ STARTED: ${bConfig.name} Level ${nextTargetLevel} is underway!`,
      finishTime
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

    // ⚔️ 1. Fetch the document directly from the model to ensure we have the 'save' method
    const village = await villageModel.findById(villageId);
    if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

    // ⚔️ 2. Locate the project to be struck from the record
    const jobIndex = village.upgradeQueue.findIndex(job => job._id.toString() === jobId);
    if (jobIndex === -1) {
      return res.status(404).json({ error: "📜 VANISHED: That project is no longer in the queue." });
    }

    const job = village.upgradeQueue[jobIndex];
    const bConfig = BUILDINGS[job.building];
    const cancelledLevel = job.targetLevel;

    // 💰 3. CALCULATE REFUND
    const costMultiplierLevel = cancelledLevel - 1;
    const woodRefund = Math.floor(bConfig.baseCost.wood * Math.pow(bConfig.costMultiplier, costMultiplierLevel));
    const clayRefund = Math.floor(bConfig.baseCost.clay * Math.pow(bConfig.costMultiplier, costMultiplierLevel));
    const stoneRefund = Math.floor(bConfig.baseCost.stone * Math.pow(bConfig.costMultiplier, costMultiplierLevel));
    const popToRelease = bConfig.basePop 
      ? Math.floor(bConfig.basePop * Math.pow(bConfig.popMultiplier, costMultiplierLevel)) 
      : 0;

    // 🔄 4. THE CHAIN REPAIR (The Shift)
    // We remove the job and decrement targetLevel for any subsequent jobs of the same building type
    village.upgradeQueue.splice(jobIndex, 1);

    village.upgradeQueue.forEach(q => {
      if (q.building === job.building && q.targetLevel > cancelledLevel) {
        q.targetLevel -= 1;
        
        // ⏳ Optional: Adjust finish time here if you want Level 3 to finish faster now that it's Level 2
      }
    });

    // 🏗️ 5. UPDATE COFFERS AND SAVE
    village.resources.wood += woodRefund;
    village.resources.clay += clayRefund;
    village.resources.stone += stoneRefund;
    village.population.used = Math.max(0, village.population.used - popToRelease);

    // Use .save() to ensure Mongoose middleware and array tracking work correctly
    await village.save();

    res.status(200).json({
      success: true,
      message: `⚒️ RESTRUCTURED: ${bConfig.name} Level ${cancelledLevel} halted. The line of succession has been updated.`,
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

    const trainingBuilding = uConfig.requirements?.barracks ? 'barracks' : 'stable';
    const buildingLevel = village.buildings[trainingBuilding] || 0;
    const bConfig = BUILDINGS[trainingBuilding];
    const growthFactor = bConfig?.growthFactor || 0.1; 
    
    const speedMultiplier = 1 + (buildingLevel * growthFactor);
    const timePerUnit = uConfig.trainTime / speedMultiplier;
    const totalDuration = timePerUnit * amount;

    // 🔄 4. QUEUE SEQUENCING (The Chain of Command)
    const now = new Date();
    let startTime;

    if (village.trainingQueue && village.trainingQueue.length > 0) {
      // Find the last job in the existing queue
      const lastJob = village.trainingQueue[village.trainingQueue.length - 1];
      const lastFinish = new Date(lastJob.finishTime);

      // If the last finish time is in the past, the building was idle.
      // We start from NOW. Otherwise, we start exactly when the last one finishes.
      startTime = lastFinish < now ? now : lastFinish;
    } else {
      // The grounds are empty; start immediately.
      startTime = now;
    }

    const finishTime = new Date(startTime.getTime() + totalDuration * 1000);

    village.resources.wood -= totalWood;
    village.resources.clay -= totalClay;
    village.resources.stone -= totalStone;
    village.population.used += totalPop;

    village.trainingQueue.push({
      unitKey,
      amount,
      startTime,
      finishTime,
      totalDuration
    });

    await village.save();

    res.status(200).json({
      success: true,
      message: `⚔️ MUSTERED: ${amount} ${uConfig.name} have been added to the training grounds.`,
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

    const village = await villageModel.findById(villageId);
    if (!village) return res.status(404).json({ error: "🏰 MYSTERY: This land is not on our maps." });

    const jobIndex = village.trainingQueue.findIndex(j => j._id.toString() === jobId);
    if (jobIndex === -1) {
      return res.status(404).json({ error: "📜 VANISHED: This order is no longer in the scrolls." });
    }

    const job = village.trainingQueue[jobIndex];
    const uConfig = UNITS[job.unitKey];

    // 💰 1. THE REBATE
    const refundFactor = 0.9; 
    village.resources.wood += Math.floor((uConfig.baseCost.wood || 0) * job.amount * refundFactor);
    village.resources.clay += Math.floor((uConfig.baseCost.clay || 0) * job.amount * refundFactor);
    village.resources.stone += Math.floor((uConfig.baseCost.stone || 0) * job.amount * refundFactor);
    village.population.used = Math.max(0, village.population.used - (uConfig.population * job.amount));

    // ⚔️ 2. THE SURGERY
    const wasFirst = jobIndex === 0;
    village.trainingQueue.splice(jobIndex, 1);

    // ⏳ 3. THE CHAIN REPAIR (With Speed Multipliers)
    let runningTimestamp = Date.now();

    village.trainingQueue.forEach((item, index) => {
      const itemConfig = UNITS[item.unitKey];
      
      // Calculate speed based on building level
      const trainingBuilding = itemConfig.requirements?.barracks ? 'barracks' : 'stable';
      const buildingLevel = village.buildings[trainingBuilding] || 0;
      const bConfig = BUILDINGS[trainingBuilding];
      const growthFactor = bConfig?.growthFactor || 0.1; 
      
      const speedMultiplier = 1 + (buildingLevel * growthFactor);
      const timePerUnit = itemConfig.trainTime / speedMultiplier;
      const totalDurationMs = (timePerUnit * item.amount) * 1000;

      if (index === 0 && !wasFirst) {
        // If the first unit stayed at the front, do not reset its progress
        runningTimestamp = Number(item.finishTime);
      } else {
        // Shift this unit and everyone behind it
        const newStart = runningTimestamp;
        const newFinish = newStart + totalDurationMs;
        
        item.startTime = newStart;
        item.finishTime = newFinish;
        
        runningTimestamp = newFinish;
      }
    });

    // 🛡️ 4. COMMIT TO THE CHRONICLES
    village.markModified('trainingQueue');
    await village.save();

    res.status(200).json({
      success: true,
      message: "🕊️ DISSOLVED: The training grounds have been cleared and the line moves forward.",
      village
    });

  } catch (error) {
    console.error("Cancel Recruitment Error:", error);
    res.status(500).json({ error: "⚡ OMEN: The heavens forbid halting this work." });
  }
};