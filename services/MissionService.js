const UNITS = require('../config/units');
const { VillageSchema } = require('../Models/Village');
const { MissionSchema } = require('../Models/Mission');
const { ReportSchema } = require('../Models/Report');
const WorldPlayerSchema = require('../Models/WorldPlayer');
const { DragonEggSchema } = require('../Models/DragonEgg');
const { getPerkMultipliers } = require('../config/kingPerks');

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
        await this.resolveAttack(village, mission, VillageModel, MissionModel, ReportModel, worldConn);
      } else if (mission.type === 'scout') {
        await this.resolveScout(village, mission, VillageModel, MissionModel, ReportModel, worldConn);
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

  async resolveAttack(defenderVillage, mission, VillageModel, MissionModel, ReportModel, worldConn)
  {
      const attackerUnits = mission.units;
      const defenderUnits = defenderVillage.army;

let totalAtk = 0;
      let cavalryAtk = 0;
      let totalDef = 0;
      let totalCapacity = 0;
      const attackerInitial = Object.fromEntries(attackerUnits);
      const defenderInitial = defenderUnits.toObject ? defenderUnits.toObject() : { ...defenderUnits };

      // Load king perks for attacker and defender
      const WPModelForPerks = worldConn.models.WorldPlayer || worldConn.model('WorldPlayer', WorldPlayerSchema);
      const [atkWP, defWP] = await Promise.all([
        WPModelForPerks.findById(mission.lord).select('kingLevel race kingNodes').lean(),
        WPModelForPerks.findById(defenderVillage.ownerId).select('kingLevel kingNodes').lean(),
      ]);
      const atkPerks = getPerkMultipliers(atkWP);

      // 🩸📜 The attacker's blood and books both affect what they can carry.
      // Guarded: an origin village with no populated research list simply
      // contributes nothing rather than throwing.
      let attackerLootBonus = 0;
      try {
        const { getRaceTraits } = require('../config/races');
        const { sumEffect } = require('../config/researches');
        attackerLootBonus =
          (getRaceTraits(atkWP?.race).lootCapacity || 0) +
          sumEffect(mission.originVillage?.completedResearches || [], 'loot_capacity');
      } catch (_) { attackerLootBonus = 0; }
      const defPerks = getPerkMultipliers(defWP);

      // 1. Calculate Attacker Strength (with perk bonus)
      for (const [uKey, count] of attackerUnits.entries())
      {
          const uCfg = UNITS[uKey];
          const power = (uCfg?.attack || 0) * count;
          totalAtk += power;
          if (uCfg?.category === 'cavalry') cavalryAtk += power;
      }
      totalAtk = Math.floor(totalAtk * (1 + atkPerks.attackBonus));

      // 2. Calculate Defender Strength (Wall Bonus + perk bonus)
      const wallBonus = 1 + ((defenderVillage.buildings?.wall || 0) * 0.05);
      // How much of the incoming attack rides. 0 = all foot, 1 = all horse.
      const cavalryShare = totalAtk > 0 ? cavalryAtk / totalAtk : 0;

      for (const [uKey, count] of Object.entries(defenderInitial))
      {
          if (uKey === '_id' || uKey === '__v' || uKey === 'wounded') continue;
          // 🛡️ A garrison has two defence values: one against foot, one
          // against horse. Blend them by how mounted the attack actually is.
          const dCfg = UNITS[uKey];
          const vsFoot = dCfg?.defenseGeneral || 0;
          const vsHorse = dCfg?.defenseCavalry || 0;
          const blended = vsFoot * (1 - cavalryShare) + vsHorse * cavalryShare;
          totalDef += blended * count * wallBonus;
      }
      totalDef = Math.floor(totalDef * (1 + defPerks.defenseBonus));

      const atkWin = totalAtk > totalDef;
      const lossRatio = totalDef === 0 || totalAtk === 0 ? 0 : (atkWin ? (totalDef / totalAtk) : (totalAtk / totalDef));

      // 🏥 HOSPITAL SURVIVAL LOGIC (Normal Units Only)
      // Every level of hospital saves 5% of the troops that would have died
      const hospLevel = defenderVillage.buildings?.hospital || 0;
      const survivalRate = Math.min(hospLevel * 0.05 * (1 + defPerks.hospitalBonus), 0.60); // Perk raises cap slightly

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
              // 🐴 `lootCapacity` is the real field. Race traits (the Emberhorde
              // carry a third again) and the Reinforced Packs study stack on the perk.
              totalCapacity += (UNITS[uKey]?.lootCapacity || 0) * survivors
                  * (1 + atkPerks.lootBonus + attackerLootBonus);
              anySurvivors = true;
          }
      }

      // 5. Looting Logic
      // Gold is not plunderable — it lives in the mine, not the warehouse.
      const lootedResources = { wood: 0, clay: 0, stone: 0 };
      if (atkWin && anySurvivors)
      {
          const resourcesAvailable = ['wood', 'clay', 'stone'];
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
      // Everything both sides are entitled to see. A report that hides the
      // enemy's army cannot explain its own outcome.
      const battleMath = {
          attackPower: totalAtk,
          defencePower: totalDef,
          wallLevel: defenderVillage.buildings?.wall || 0,
          wallBonus: Number(wallBonus.toFixed(2)),
          cavalryShare: Number(cavalryShare.toFixed(2)),
          hospitalLevel: hospLevel,
          lootCapacity: Math.floor(totalCapacity),
      };

      const commonData = {
          ...battleMath,
          unitsSent: attackerInitial,
          unitsDefending: defenderInitial,
          attackerLosses,
          defenderLosses,
          targetName: defenderVillage.name,
          targetCoords: { x: defenderVillage.x, y: defenderVillage.y },
          attackerName: mission.originVillage?.name || "Unknown Lord",
          attackerCoords: { x: mission.originCoords.x, y: mission.originCoords.y },
          result: atkWin ? 'Victory' : 'Defeat'
      };

      // Dragon Egg Transfer: if attacker wins and defender has an egg
      let dragonEggFound = false;
      if (atkWin && defenderVillage.dragonEgg) {
        try {
          const DragonEggModel = worldConn.models.DragonEgg || worldConn.model('DragonEgg', DragonEggSchema);
          const egg = await DragonEggModel.findById(defenderVillage.dragonEgg);
          if (egg) {
            egg.foundBy = mission.originVillage._id;
            egg.takenAt = new Date();
            await egg.save();
            // Transfer to origin village
            await VillageModel.findByIdAndUpdate(mission.originVillage._id, { dragonEgg: egg._id });
            defenderVillage.dragonEgg = null;
            dragonEggFound = true;
          }
        } catch (e) { console.error('Egg transfer error:', e); }
      }

      // Conquerable: attacker wins (all defenders defeated)
      const isConquerable = atkWin && defenderVillage.ownerId.toString() !== mission.lord.toString();

      // Attacker Report
      await new ReportModel({
          recipient: mission.lord,
          type: 'MISSION_COMBAT',
          title: `Battle at ${defenderVillage.name}`,
          originVillage: mission.originVillage._id,
          data: {
            ...commonData,
            loot: lootedResources,
            losses: attackerLosses,
            unitsSent: attackerInitial,
            dragonEggFound,
            conquerable: isConquerable,
            targetVillageId: defenderVillage._id.toString(),
          }
      }).save();

      // Defender Report (Shows permanent losses and saved wounded)
      await new ReportModel({
          recipient: defenderVillage.ownerId,
          type: 'MISSION_COMBAT',
          title: `Siege of ${defenderVillage.name}`,
          originVillage: mission.originVillage._id,
          data: { ...commonData, result: atkWin ? 'Defeat' : 'Victory', lootLost: lootedResources, losses: defenderLosses, wounded: newlyWounded, unitsDefending: defenderInitial }
      }).save();

      // 6b. ── STAT TRACKING ──────────────────────────────────────────────────
      if (worldConn) {
        try {
          const WorldPlayerModel = worldConn.models.WorldPlayer || worldConn.model('WorldPlayer', WorldPlayerSchema);
          const atkKilled  = Object.values(defenderLosses).reduce((s, n) => s + n, 0);
          const atkLost    = Object.values(attackerLosses).reduce((s, n) => s + n, 0);
          const plundered  = Object.values(lootedResources).reduce((s, n) => s + n, 0);
          const atkXPGain  = (atkWin ? 50 : 10) + atkKilled;
          const defXPGain  = (atkWin ? 5 : 30) + atkLost;

          await Promise.all([
            WorldPlayerModel.updateOne({ _id: mission.lord }, {
              $inc: {
                'stats.battlesWon':         atkWin ? 1 : 0,
                'stats.battlesLost':        atkWin ? 0 : 1,
                'stats.troopsKilled':       atkKilled,
                'stats.troopsLost':         atkLost,
                'stats.resourcesPlundered': plundered,
                kingXP: atkXPGain,
              }
            }),
            WorldPlayerModel.updateOne({ _id: defenderVillage.ownerId }, {
              $inc: {
                'stats.battlesWon':  atkWin ? 0 : 1,
                'stats.battlesLost': atkWin ? 1 : 0,
                'stats.troopsKilled': atkLost,
                'stats.troopsLost':   atkKilled,
                kingXP: defXPGain,
              }
            }),
          ]);

          // Recompute king level for both players (floor(sqrt(XP/100)) + 1, max 20)
          const levelFromXP = (xp) => Math.min(20, Math.floor(Math.sqrt(xp / 100)) + 1);
          const [atkPlayer, defPlayer] = await Promise.all([
            WorldPlayerModel.findById(mission.lord).select('kingXP').lean(),
            WorldPlayerModel.findById(defenderVillage.ownerId).select('kingXP').lean(),
          ]);
          if (atkPlayer) await WorldPlayerModel.updateOne({ _id: mission.lord }, { kingLevel: levelFromXP(atkPlayer.kingXP) });
          if (defPlayer) await WorldPlayerModel.updateOne({ _id: defenderVillage.ownerId }, { kingLevel: levelFromXP(defPlayer.kingXP) });
        } catch (e) { console.error('Stat update error:', e); }
      }
      // ─────────────────────────────────────────────────────────────────────

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

  async resolveScout(scoutedVillage, mission, VillageModel, MissionModel, ReportModel, worldConn) {
    // Reveal army composition and check for dragon egg
    const armySnapshot = scoutedVillage.army ? scoutedVillage.army.toObject
      ? scoutedVillage.army.toObject()
      : { ...scoutedVillage.army }
      : {};

    let dragonEggPresent = false;
    if (scoutedVillage.dragonEgg) dragonEggPresent = true;

    await new ReportModel({
      recipient: mission.lord,
      type: 'MISSION_SCOUT',
      title: `Scout Report: ${scoutedVillage.name}`,
      originVillage: mission.originVillage._id,
      data: {
        targetName: scoutedVillage.name,
        targetCoords: { x: scoutedVillage.x, y: scoutedVillage.y },
        army: armySnapshot,
        dragonEggPresent,
        buildings: scoutedVillage.buildings,
        resources: scoutedVillage.resources,
      }
    }).save();

    // Return scout units to origin
    const travelTime = new Date(mission.arrivalTime).getTime() - new Date(mission.departureTime).getTime();
    const returnMission = new MissionModel({
      type: 'return',
      originVillage: mission.targetVillage,
      targetVillage: mission.originVillage,
      targetCoords: { x: mission.originCoords.x, y: mission.originCoords.y },
      lord: mission.lord,
      units: mission.units,
      resources: { wood: 0, clay: 0, stone: 0, iron: 0 },
      departureTime: mission.arrivalTime,
      arrivalTime: new Date(new Date(mission.arrivalTime).getTime() + travelTime),
      status: 'marching'
    });
    await returnMission.save();

    await VillageModel.findByIdAndUpdate(mission.originVillage, {
      $push: { incomingMissions: returnMission._id },
      $pull: { outgoingMissions: mission._id }
    });
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