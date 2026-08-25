const VillageService = require('../services/VillageService');
const ResearchService = require('../services/ResearchService');
const { RESEARCHES, researchesForRace } = require('../config/researches');
const { RACES, DEFAULT_RACE } = require('../config/races');

/**
 * 📜 THE LIBRARY
 *
 * Three acts: read what may be studied, begin a study, abandon one.
 * Ownership is proven by the `villageOwner` guard before any of this runs.
 */

/** Everything the Library screen needs in one call. */
exports.getResearchState = async (req, res) => {
  try {
    const { villageId } = req.params;
    const raceKey = req.worldPlayer.race || DEFAULT_RACE;

    const village = await VillageService.getUpdatedVillage(villageId, req.world);
    if (!village) return res.status(404).json({ error: '🏰 MYSTERY: This land is not on our maps.' });

    const done = village.completedResearches || [];
    const queue = village.researchQueue || [];
    const libLevel = (village.buildings && village.buildings.library) || 0;
    const available = researchesForRace(raceKey);

    // Annotate each study with why it can or cannot be begun right now
    const catalogue = Object.values(available).map(r => {
      const isDone = done.includes(r.key);
      const inProgress = queue.some(j => j.researchKey === r.key);
      const needLib = (r.requirements && r.requirements.library) || 0;
      const missingPrereqs = (r.requirements.researches || []).filter(p => !done.includes(p));

      return {
        ...r,
        state: isDone ? 'known' : inProgress ? 'studying' : 'available',
        libraryMet: libLevel >= needLib,
        libraryNeeded: needLib,
        missingPrereqs,
        locked: !isDone && !inProgress && (libLevel < needLib || missingPrereqs.length > 0),
      };
    });

    res.status(200).json({
      success: true,
      race: RACES[raceKey] || RACES[DEFAULT_RACE],
      libraryLevel: libLevel,
      completedResearches: done,
      researchQueue: queue,
      modifiers: ResearchService.getModifiers(village, raceKey),
      researches: catalogue,
      serverTime: Date.now(),
    });
  } catch (error) {
    console.error('Research State Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The stacks are dark; the scribes cannot read.' });
  }
};

/** Begin a study. Costs are taken up front; the queue holds one at a time. */
exports.startResearch = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { researchKey } = req.body;
    const raceKey = req.worldPlayer.race || DEFAULT_RACE;
    const villageModel = req.getVillageModel();

    const village = await VillageService.getUpdatedVillage(villageId, req.world);
    if (!village) return res.status(404).json({ error: '🏰 MYSTERY: This land is not on our maps.' });

    const check = ResearchService.validateStart(village, raceKey, researchKey);
    if (!check.ok) {
      return res.status(check.code || 400).json({ error: check.reason });
    }

    const { research, cost, durationMs } = check;
    const startTime = Date.now();
    const finishTime = startTime + durationMs;

    // Conditional write: the resource guards are repeated here so two requests
    // racing each other cannot both pass the check above and both deduct.
    const result = await villageModel.updateOne(
      {
        _id: villageId,
        'resources.wood':  { $gte: cost.wood  || 0 },
        'resources.clay':  { $gte: cost.clay  || 0 },
        'resources.stone': { $gte: cost.stone || 0 },
        'resources.gold':  { $gte: cost.gold  || 0 },
        researchQueue: { $size: 0 },
        completedResearches: { $ne: researchKey },
      },
      {
        $inc: {
          'resources.wood':  -(cost.wood  || 0),
          'resources.clay':  -(cost.clay  || 0),
          'resources.stone': -(cost.stone || 0),
          'resources.gold':  -(cost.gold  || 0),
        },
        $push: {
          researchQueue: {
            researchKey,
            startTime,
            finishTime,
            costs: {
              wood:  cost.wood  || 0,
              clay:  cost.clay  || 0,
              stone: cost.stone || 0,
              gold:  cost.gold  || 0,
            },
          },
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        error: '📜 CONTESTED: The scholars were claimed by another order a moment ago.',
      });
    }

    res.status(200).json({
      success: true,
      message: `📜 BEGUN: The scholars turn to "${research.name}".`,
      researchKey,
      finishTime,
    });
  } catch (error) {
    console.error('Start Research Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The scholars have scattered their notes.' });
  }
};

/** Abandon a study. Half the outlay is recovered — parchment does not un-write. */
exports.cancelResearch = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { researchKey } = req.body;
    const villageModel = req.getVillageModel();

    const village = await villageModel.findById(villageId);
    if (!village) return res.status(404).json({ error: '🏰 MYSTERY: This land is not on our maps.' });

    const idx = (village.researchQueue || []).findIndex(j => j.researchKey === researchKey);
    if (idx === -1) {
      return res.status(404).json({ error: '📜 VANISHED: No such work sits on the desks.' });
    }

    const job = village.researchQueue[idx];
    const costs = job.costs || {};
    village.researchQueue.splice(idx, 1);

    // Half back, and never above what the stores can physically hold.
    const cap = village.resources.maxStorage || Infinity;
    village.resources.wood  = Math.min(cap, village.resources.wood  + Math.floor((costs.wood  || 0) / 2));
    village.resources.clay  = Math.min(cap, village.resources.clay  + Math.floor((costs.clay  || 0) / 2));
    village.resources.stone = Math.min(cap, village.resources.stone + Math.floor((costs.stone || 0) / 2));
    village.resources.gold  = village.resources.gold + Math.floor((costs.gold || 0) / 2);

    village.markModified('researchQueue');
    village.markModified('resources');
    await village.save();

    const nice = RESEARCHES[researchKey] ? RESEARCHES[researchKey].name : researchKey;
    res.status(200).json({
      success: true,
      message: `📜 ABANDONED: Work on "${nice}" is set aside. Half the outlay is recovered.`,
      village,
    });
  } catch (error) {
    console.error('Cancel Research Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The scholars refuse to put down their pens.' });
  }
};
