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

  async resolveAttack(defenderVillage, mission, VillageModel, MissionModel, ReportModel)
  {
      const attackerUnits = mission.units;
      const defenderUnits = defenderVillage.army;

      let totalAtk = 0;
      let totalDef = 0;
      let totalCapacity = 0;
      const attackerInitial = Object.fromEntries(attackerUnits);
      const defenderInitial = defenderUnits.toObject ? defenderUnits.toObject() : { ...defenderUnits };

      // 1. Calculate Attacker Strength
      for (const [uKey, count] of attackerUnits.entries())
      {
          totalAtk += (UNITS[uKey]?.attack || 0) * count;
      }

      // 2. Calculate Defender Strength (Wall Bonus)
      const wallBonus = 1 + ((defenderVillage.buildings?.wall || 0) * 0.05);
      for (const [uKey, count] of Object.entries(defenderInitial))
      {
          if (uKey === '_id' || uKey === '__v' || uKey === 'wounded') continue;
          totalDef += (UNITS[uKey]?.defenseInfantry || 0) * count * wallBonus;
      }

      const atkWin = totalAtk > totalDef;
      const lossRatio = totalDef === 0 || totalAtk === 0 ? 0 : (atkWin ? (totalDef / totalAtk) : (totalAtk / totalDef));

      // 🏥 HOSPITAL SURVIVAL LOGIC (Normal Units Only)
      // Every level of hospital saves 5% of the troops that would have died
      const hospLevel = defenderVillage.buildings?.hospital || 0;
      const survivalRate = Math.min(hospLevel * 0.05, 0.50); // Cap at 50% recovery

      const attackerLosses = {};
      const defenderLosses = {};
      const newlyWounded = {};

      // 3. Process Defender Losses & Recovery
      for (const uKey of Object.keys(defenderInitial))
      {
          if (uKey === '_id' || uKey === '__v' || uKey === 'wounded' || uKey === 'common_slave') continue;
          
          const currentCount = defenderUnits[uKey] || 0;
          const totalPotentialLosses = Math.floor(currentCount * (atkWin ? 1 : lossRatio));
          
          if (totalPotentialLosses > 0)
          {
              // Hospital saves a portion of the normal units
              const savedByHospital = Math.floor(totalPotentialLosses * survivalRate);
              const actualPermanentLosses = totalPotentialLosses - savedByHospital;

              defenderLosses[uKey] = actualPermanentLosses;
              
              // Move "saved" units to the wounded state
              if (savedByHospital > 0)
              {
                  newlyWounded[uKey] = savedByHospital;
                  
                  // Initialize wounded object if it doesn't exist
                  if (!defenderUnits.wounded) defenderUnits.wounded = {};
                  
                  defenderUnits.wounded[uKey] = (defenderUnits.wounded[uKey] || 0) + savedByHospital;
              }

              // Subtract all losses (both dead and wounded) from the active army
              defenderUnits[uKey] = Math.max(0, currentCount - totalPotentialLosses);
          }
      }

      // 4. Process Attacker Losses (Attackers don't get hospital benefits on foreign soil)
      const returningUnits = {};
      let anySurvivors = false;
      for (const [uKey, count] of attackerUnits.entries())
      {
          const survivors = Math.floor(count * (atkWin ? (1 - lossRatio) : 0));
          const losses = count - survivors;
          if (losses > 0) attackerLosses[uKey] = losses;
          if (survivors > 0)
          {
              returningUnits[uKey] = survivors;
              totalCapacity += (UNITS[uKey]?.capacity || 0) * survivors;
              anySurvivors = true;
          }
      }

      // 5. Looting Logic
      const lootedResources = { wood: 0, clay: 0, stone: 0, iron: 0 };
      if (atkWin && anySurvivors)
      {
          const resourcesAvailable = ['wood', 'clay', 'stone', 'iron'];
          const totalResValue = resourcesAvailable.reduce((sum, res) => sum + (defenderVillage.resources[res] || 0), 0);
          
          if (totalResValue > 0)
          {
              const lootAmount = Math.min(totalCapacity, totalResValue);
              resourcesAvailable.forEach(res =>
              {
                  const share = (defenderVillage.resources[res] || 0) / totalResValue;
                  const taken = Math.floor(lootAmount * share);
                  lootedResources[res] = taken;
                  defenderVillage.resources[res] -= taken;
              });
          }
      }

      // 6. Finalize State and Reports
      const commonData = {
          targetName: defenderVillage.name,
          targetCoords: { x: defenderVillage.x, y: defenderVillage.y },
          attackerName: mission.originVillage?.name || "Unknown Lord",
          attackerCoords: { x: mission.originCoords.x, y: mission.originCoords.y },
          result: atkWin ? 'Victory' : 'Defeat'
      };

      // Attacker Report
      await new ReportModel({
          recipient: mission.lord,
          type: 'MISSION_COMBAT',
          title: `Battle at ${defenderVillage.name}`,
          originVillage: mission.originVillage._id,
          data: { ...commonData, loot: lootedResources, losses: attackerLosses, unitsSent: attackerInitial }
      }).save();

      // Defender Report (Shows permanent losses and saved wounded)
      await new ReportModel({
          recipient: defenderVillage.ownerId,
          type: 'MISSION_COMBAT',
          title: `Siege of ${defenderVillage.name}`,
          originVillage: mission.originVillage._id,
          data: { ...commonData, result: atkWin ? 'Defeat' : 'Victory', lootLost: lootedResources, losses: defenderLosses, wounded: newlyWounded, unitsDefending: defenderInitial }
      }).save();

      // 7. Handle Returning Army
      if (anySurvivors)
      {
          const travelTime = new Date(mission.arrivalTime).getTime() - new Date(mission.departureTime).getTime();
          const returnMission = new MissionModel({
              type: 'return',
              originVillage: mission.targetVillage,
              targetVillage: mission.originVillage,
              targetCoords: { x: mission.originCoords.x, y: mission.originCoords.y },
              lord: mission.lord,
              units: returningUnits,
              resources: lootedResources,
              departureTime: mission.arrivalTime,
              arrivalTime: new Date(new Date(mission.arrivalTime).getTime() + travelTime),
              status: 'marching'
          });
          await returnMission.save();

          await VillageModel.findByIdAndUpdate(mission.originVillage, {
              $push: { incomingMissions: returnMission._id },
              $pull: { outgoingMissions: mission._id }
          });
      }
      else
      {
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