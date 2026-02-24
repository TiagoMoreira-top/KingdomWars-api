const UNITS = require('../config/units');
const { VillageSchema } = require('../Models/Village');
const { MissionSchema } = require('../Models/Mission');
const { ReportSchema } = require('../Models/Report');

const MissionService = {
  async processArrivals(village, worldConn, now) {
    const VillageModel = worldConn.models.Village || worldConn.model('Village', VillageSchema);
    const MissionModel = worldConn.models.Mission || worldConn.model('Mission', MissionSchema);
    const ReportModel = worldConn.models.Report || worldConn.model('Report', ReportSchema);

    const arrivedMissions = await MissionModel.find({
      targetVillage: village._id,
      arrivalTime: { $lte: new Date(now) },
      status: 'marching'
    }).populate({ path: 'originVillage', model: VillageModel });

    if (arrivedMissions.length === 0) return village;

    arrivedMissions.sort((a, b) => a.arrivalTime - b.arrivalTime);

    for (const mission of arrivedMissions) {
      if (mission.type === 'attack') {
        await this.resolveAttack(village, mission, VillageModel, MissionModel, ReportModel);
      } else if (mission.type === 'support') {
        await this.resolveSupport(village, mission, ReportModel);
      } else if (mission.type === 'return') {
        await this.resolveReturn(village, mission, ReportModel);
      }
      
      mission.status = 'completed';
      await mission.save();
      village.incomingMissions.pull(mission._id);
    }

    village.markModified('incomingMissions');
    village.markModified('army');
    village.markModified('resources');
    return village;
  },

  async resolveAttack(defenderVillage, mission, VillageModel, MissionModel, ReportModel) {
    const attackerUnits = mission.units; 
    const defenderUnits = defenderVillage.army; 

    let totalAtk = 0;
    let totalDef = 0;
    let totalCapacity = 0;
    const attackerInitial = Object.fromEntries(attackerUnits);
    const defenderInitial = defenderUnits.toObject ? defenderUnits.toObject() : { ...defenderUnits };

    for (const [uKey, count] of attackerUnits.entries()) {
      totalAtk += (UNITS[uKey]?.attack || 0) * count;
    }

    const wallBonus = 1 + ((defenderVillage.buildings?.wall || 0) * 0.05);
    for (const [uKey, count] of Object.entries(defenderInitial)) {
      if (uKey === '_id' || uKey === '__v') continue; 
      totalDef += (UNITS[uKey]?.defenseInfantry || 0) * count * wallBonus;
    }

    const atkWin = totalAtk > totalDef;
    const lossRatio = totalDef === 0 || totalAtk === 0 ? 0 : (atkWin ? (totalDef / totalAtk) : (totalAtk / totalDef));

    const attackerLosses = {};
    const defenderLosses = {};

    for (const uKey of Object.keys(defenderInitial)) {
      if (uKey === '_id' || uKey === '__v') continue;
      const currentCount = defenderUnits[uKey] || 0;
      const losses = Math.floor(currentCount * (atkWin ? 1 : lossRatio));
      if (losses > 0) defenderLosses[uKey] = losses;
      defenderUnits[uKey] = Math.max(0, currentCount - losses);
    }

    const returningUnits = {};
    let anySurvivors = false;
    for (const [uKey, count] of attackerUnits.entries()) {
      const survivors = Math.floor(count * (atkWin ? (1 - lossRatio) : 0));
      const losses = count - survivors;
      if (losses > 0) attackerLosses[uKey] = losses;
      if (survivors > 0) {
        returningUnits[uKey] = survivors;
        totalCapacity += (UNITS[uKey]?.capacity || 0) * survivors;
        anySurvivors = true;
      }
    }

    // 💰 LOOTING LOGIC
    const lootedResources = { wood: 0, clay: 0, stone: 0, iron: 0 };
    if (atkWin && anySurvivors) {
      const resourcesAvailable = ['wood', 'clay', 'stone', 'iron'];
      const totalResources = resourcesAvailable.reduce((sum, res) => sum + defenderVillage.resources[res], 0);
      
      if (totalResources > 0) {
        const lootAmount = Math.min(totalCapacity, totalResources);
        resourcesAvailable.forEach(res => {
          const share = defenderVillage.resources[res] / totalResources;
          const taken = Math.floor(lootAmount * share);
          lootedResources[res] = taken;
          defenderVillage.resources[res] -= taken;
        });
      }
    }

    const commonData = {
      targetName: defenderVillage.name,
      targetCoords: { x: defenderVillage.x, y: defenderVillage.y },
      attackerName: mission.originVillage?.name || "Unknown Lord",
      attackerCoords: { x: mission.originVillage?.x, y: mission.originVillage?.y },
      result: atkWin ? 'Victory' : 'Defeat'
    };

    await new ReportModel({
      recipient: mission.lord,
      type: 'MISSION_COMBAT',
      title: `Battle at ${defenderVillage.name}`,
      originVillage: mission.originVillage._id,
      data: { ...commonData, loot: lootedResources, losses: attackerLosses, unitsSent: attackerInitial }
    }).save();

    await new ReportModel({
      recipient: defenderVillage.ownerId,
      type: 'MISSION_COMBAT',
      title: `Siege of ${defenderVillage.name}`,
      originVillage: mission.originVillage._id,
      data: { ...commonData, result: atkWin ? 'Defeat' : 'Victory', lootLost: lootedResources, losses: defenderLosses, unitsDefending: defenderInitial }
    }).save();

    if (anySurvivors) {
      const travelTime = new Date(mission.arrivalTime).getTime() - new Date(mission.departureTime).getTime();
      const returnMission = new MissionModel({
        type: 'return',
        originVillage: mission.targetVillage,
        targetVillage: mission.originVillage,
        targetCoords: { 
          x: mission.originCoords.x, 
          y: mission.originCoords.y 
        },
        lord: mission.lord,
        units: returningUnits,
        resources: lootedResources, // 🎒 Load the loot onto the returning army
        departureTime: mission.arrivalTime,
        arrivalTime: new Date(new Date(mission.arrivalTime).getTime() + travelTime),
        status: 'marching'
      });
      await returnMission.save();

      await VillageModel.findByIdAndUpdate(mission.originVillage, {
        $push: { incomingMissions: returnMission._id },
        $pull: { outgoingMissions: mission._id }
      });
    } else {
      await VillageModel.findByIdAndUpdate(mission.originVillage, { $pull: { outgoingMissions: mission._id } });
    }

    defenderVillage.markModified('army');
    defenderVillage.markModified('resources');
  },

  async resolveReturn(village, mission, ReportModel) {
    // 🎁 Add returning units back to garrison
    for (const [uKey, count] of mission.units.entries()) {
      village.army[uKey] = (village.army[uKey] || 0) + count;
    }

    // 💰 Deposit looted resources
    const loot = mission.resources || { wood: 0, clay: 0, stone: 0, iron: 0 };
    village.resources.wood += loot.wood;
    village.resources.clay += loot.clay;
    village.resources.stone += loot.stone;
    village.resources.iron += loot.iron;

    // 📜 Report: The heroes have returned
    await new ReportModel({
      recipient: mission.lord,
      type: 'SYSTEM_INFO',
      title: `The Host Returns to ${village.name}`,
      data: {
        message: "Thy brave warriors have returned from their journey, bringing spoils and glory.",
        loot: loot,
        units: Object.fromEntries(mission.units)
      }
    }).save();

    village.markModified('army');
    village.markModified('resources');
  },

  async resolveSupport(village, mission, ReportModel) {
    const unitsObj = Object.fromEntries(mission.units);
    village.reinforcements.push({
      ownerId: mission.lord,
      originVillageId: mission.originVillage,
      units: unitsObj
    });

    await new ReportModel({
      recipient: village.ownerId,
      type: 'MISSION_SUPPORT',
      title: `Reinforcements Arrived at ${village.name}`,
      originVillage: mission.originVillage._id,
      data: { originName: mission.originVillage?.name, units: unitsObj, message: "Allied banners fly alongside thine own!" }
    }).save();

    village.markModified('reinforcements');
  }
};

module.exports = MissionService;