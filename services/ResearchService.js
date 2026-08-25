const { RESEARCHES, sumEffect, unlockedUnits, PATENTED_UNITS } = require('../config/researches');
const { getRaceTraits, canRaceTrain, canRaceBuild, DEFAULT_RACE } = require('../config/races');

/**
 * 📜 THE SCHOLARS
 *
 * One place that answers "what does this village actually know, and what does
 * that knowledge do?" Every other service asks here rather than reading the
 * research list itself, so the effect rules live in exactly one file.
 *
 * Race traits and completed studies stack additively. A lord of the Sylvan
 * Covenant with Crop Rotation gets +25% wood from blood and +6% from books.
 */
const ResearchService = {

  /**
   * Advance the study queue to `now`, moving anything finished into the
   * permanent record. Mutates and returns the village.
   */
  processResearch(village, now = Date.now()) {
    const queue = village.researchQueue || [];
    if (queue.length === 0) return village;

    const stillRunning = [];
    let completed = 0;

    for (const job of queue) {
      if (job.finishTime <= now) {
        if (!village.completedResearches.includes(job.researchKey)) {
          village.completedResearches.push(job.researchKey);
        }
        completed++;
      } else {
        stillRunning.push(job);
      }
    }

    if (completed > 0) {
      village.researchQueue = stillRunning;
      village.markModified('completedResearches');
      village.markModified('researchQueue');
      village._completedResearchCount = completed;
    }

    return village;
  },

  /**
   * Everything the rest of the game needs to know about a village's
   * scholarship and bloodline, resolved into plain multipliers.
   */
  getModifiers(village, raceKey = DEFAULT_RACE) {
    const done = village.completedResearches || [];
    const traits = getRaceTraits(raceKey);

    return {
      race: raceKey,
      traits,

      // Economy
      woodProduction:  traits.woodProduction  + sumEffect(done, 'production'),
      clayProduction:  traits.clayProduction  + sumEffect(done, 'production'),
      stoneProduction: traits.stoneProduction + sumEffect(done, 'production'),
      goldProduction:  traits.goldProduction  + sumEffect(done, 'gold_production'),
      storage:         sumEffect(done, 'storage'),
      goldStorage:     sumEffect(done, 'gold_storage'),

      // Works
      buildSpeed:      traits.buildTimeReduction + sumEffect(done, 'build_speed'),
      buildCost:       traits.buildCostReduction + sumEffect(done, 'build_cost'),
      extraBuildSlots: Math.floor(sumEffect(done, 'extra_building_slot')),

      // War
      unitAttack:   traits.offenceBonus + sumEffect(done, 'unit_attack'),
      unitDefence:  traits.defenceBonus + sumEffect(done, 'unit_defence'),
      recruitSpeed: traits.recruitSpeed + sumEffect(done, 'recruit_speed'),
      lootCapacity: traits.lootCapacity + sumEffect(done, 'loot_capacity'),
      troopSpeed:   traits.troopSpeed   + sumEffect(done, 'troop_speed'),
      wallStrength: traits.wallStrength,

      unlocked: unlockedUnits(done),
    };
  },

  /**
   * May this village recruit this troop right now?
   * Three gates: the people must be able to field it, a patented troop needs
   * its patent, and blocked troops are refused outright.
   */
  canRecruit(village, raceKey, unitKey) {
    if (!canRaceTrain(raceKey, unitKey)) {
      return { ok: false, reason: '🩸 FOREIGN: Thy people do not field such troops.' };
    }
    if (PATENTED_UNITS.has(unitKey)) {
      const done = village.completedResearches || [];
      if (!unlockedUnits(done).has(unitKey)) {
        return { ok: false, reason: '📜 UNSTUDIED: Thy Library has not yet issued this patent.' };
      }
    }
    return { ok: true };
  },

  /** May this village raise this structure? */
  canBuild(raceKey, buildingKey) {
    if (!canRaceBuild(raceKey, buildingKey)) {
      return { ok: false, reason: '🩸 FOREIGN: Thy people do not raise such structures.' };
    }
    return { ok: true };
  },

  /**
   * Validate a request to begin a study, without committing anything.
   * Returns { ok, reason?, research?, cost?, durationMs? }.
   */
  validateStart(village, raceKey, researchKey) {
    const research = RESEARCHES[researchKey];
    if (!research) {
      return { ok: false, code: 400, reason: '📜 UNKNOWN: No such study sits in the stacks.' };
    }

    if (research.race && research.race !== raceKey) {
      return { ok: false, code: 403, reason: '🩸 FOREIGN: This knowledge is not thy people\'s to hold.' };
    }

    const done = village.completedResearches || [];
    if (done.includes(researchKey)) {
      return { ok: false, code: 409, reason: '📜 KNOWN: Thy scholars settled this question long ago.' };
    }

    const queue = village.researchQueue || [];
    if (queue.some(j => j.researchKey === researchKey)) {
      return { ok: false, code: 409, reason: '📜 IN HAND: The scholars are already at this very question.' };
    }
    // The Library studies one question at a time.
    if (queue.length >= 1) {
      return { ok: false, code: 403, reason: '📜 OCCUPIED: Thy scholars are already deep in another work.' };
    }

    const libLevel = (village.buildings && village.buildings.library) || 0;
    const needLib = (research.requirements && research.requirements.library) || 0;
    if (libLevel < needLib) {
      return { ok: false, code: 403, reason: `📜 UNREADY: This work demands a Library of level ${needLib}.` };
    }

    for (const prereq of (research.requirements.researches || [])) {
      if (!done.includes(prereq)) {
        const nice = RESEARCHES[prereq] ? RESEARCHES[prereq].name : prereq;
        return { ok: false, code: 403, reason: `📜 FOUNDATIONS: "${nice}" must be settled first.` };
      }
    }

    const cost = research.cost || {};
    const res = village.resources || {};
    if ((res.wood || 0) < (cost.wood || 0) ||
        (res.clay || 0) < (cost.clay || 0) ||
        (res.stone || 0) < (cost.stone || 0) ||
        (res.gold || 0) < (cost.gold || 0)) {
      return { ok: false, code: 402, reason: '💰 EMPTY VAULTS: The scholars will not work unpaid.' };
    }

    // A deeper Library reads faster: 2% per level, floored at a third of base.
    const speed = Math.max(0.33, 1 - libLevel * 0.02);
    const durationMs = Math.max(1000, Math.floor(research.researchTime * speed * 1000));

    return { ok: true, research, cost, durationMs };
  },
};

module.exports = ResearchService;
