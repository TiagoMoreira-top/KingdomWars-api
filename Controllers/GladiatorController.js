const GladiatorService = require('../services/GladiatorService');
const WorldPlayerSchema = require('../Models/WorldPlayer');

exports.trainGladiator = async (req, res) => {
  try {
    const { villageID } = req.params;
    const { gladiatorId } = req.body;

    const VillageModel = req.getVillageModel();
    const GladiatorModel = req.getGladiatorModel();

    const village = await VillageModel.findById(villageID).populate('gladiators');
    const gladiator = await GladiatorModel.findById(gladiatorId);

    if (!village || !gladiator)
      return res.status(404).json({ error: '🏰 MYSTERY: The chronicles show no such warrior or village.' });

    if (gladiator.status !== 'Idle')
      return res.status(400).json({ error: '⚔️ BUSY: This warrior is already occupied with another task.' });

    const currentLevel = Number(gladiator.level) || 1;
    const cost = {
      gold:  currentLevel * 500,
      wood:  currentLevel * 100,
      clay:  currentLevel * 100,
      stone: currentLevel * 100,
    };

    if (
      village.resources.gold  < cost.gold  ||
      village.resources.wood  < cost.wood  ||
      village.resources.clay  < cost.clay  ||
      village.resources.stone < cost.stone
    ) return res.status(400).json({ error: '🪙 POVERTY: Thy treasury is too shallow for this master\'s fee.' });

    village.resources.gold  -= cost.gold;
    village.resources.wood  -= cost.wood;
    village.resources.clay  -= cost.clay;
    village.resources.stone -= cost.stone;
    village.markModified('resources');
    await village.save();

    gladiator.status = 'Training';
    gladiator.trainingUntil = new Date(Date.now() + currentLevel * 60 * 1000);
    await gladiator.save();

    res.json({
      success: true,
      message: `${gladiator.name} enters the training pits for ${currentLevel} minute(s).`,
      village,
      gladiator,
    });
  } catch (err) {
    console.error('Training error:', err);
    res.status(500).json({ error: '⚡ OMEN: The training pits have collapsed.' });
  }
};

exports.challengeGladiator = async (req, res) => {
  try {
    const { villageID } = req.params;
    const { attackerGladiatorId, defenderVillageId } = req.body;

    const VillageModel    = req.getVillageModel();
    const GladiatorModel  = req.getGladiatorModel();
    const WPModel         = req.getWorldPlayerModel();

    // --- Load attacker village + gladiator ---
    const attackerVillage = await VillageModel.findById(villageID).populate('gladiators');
    if (!attackerVillage) return res.status(404).json({ error: 'Attacker village not found.' });

    const attackerGlad = await GladiatorModel.findById(attackerGladiatorId);
    if (!attackerGlad) return res.status(404).json({ error: 'Your gladiator not found.' });
    if (attackerGlad.status !== 'Idle') return res.status(400).json({ error: 'Your gladiator must be Idle to fight.' });
    if (attackerGlad.health <= 0) return res.status(400).json({ error: 'Your gladiator is too wounded to fight.' });

    // Verify ownership
    if (attackerGlad.ownerId.toString() !== req.worldPlayer._id.toString())
      return res.status(403).json({ error: 'That is not your gladiator.' });

    // --- Load defender village + pick their best idle gladiator ---
    const defenderVillage = await VillageModel.findById(defenderVillageId).populate('gladiators');
    if (!defenderVillage) return res.status(404).json({ error: 'Defender village not found.' });
    if (defenderVillage.ownerId.toString() === req.worldPlayer._id.toString())
      return res.status(400).json({ error: 'You cannot challenge your own village.' });

    const defenderGladiators = await GladiatorModel.find({
      _id: { $in: defenderVillage.gladiators },
      status: 'Idle',
    }).sort({ battlePoints: -1, level: -1 });

    if (!defenderGladiators.length)
      return res.status(400).json({ error: 'That village has no idle gladiators to challenge.' });

    const defenderGlad = defenderGladiators[0]; // challenge their strongest

    // --- Resolve the fight ---
    const result = GladiatorService.resolveFight(attackerGlad, defenderGlad);

    await Promise.all([attackerGlad.save(), defenderGlad.save()]);

    // --- Update player stats + king XP ---
    const attackerWP = await WPModel.findById(req.worldPlayer._id);
    const defenderWP = await WPModel.findOne({ _id: defenderVillage.ownerId });

    if (result.attackerWins) {
      if (attackerWP) {
        attackerWP.stats = attackerWP.stats || {};
        attackerWP.stats.gladiatorWins = (attackerWP.stats.gladiatorWins || 0) + 1;
        attackerWP.kingXP = (attackerWP.kingXP || 0) + 50;
        attackerWP.kingLevel = Math.min(20, Math.floor(Math.sqrt(attackerWP.kingXP / 100)) + 1);
        await attackerWP.save();
      }
      if (defenderWP) {
        defenderWP.stats = defenderWP.stats || {};
        defenderWP.stats.gladiatorLosses = (defenderWP.stats.gladiatorLosses || 0) + 1;
        await defenderWP.save();
      }
    } else {
      if (defenderWP) {
        defenderWP.stats = defenderWP.stats || {};
        defenderWP.stats.gladiatorWins = (defenderWP.stats.gladiatorWins || 0) + 1;
        defenderWP.kingXP = (defenderWP.kingXP || 0) + 50;
        defenderWP.kingLevel = Math.min(20, Math.floor(Math.sqrt(defenderWP.kingXP / 100)) + 1);
        await defenderWP.save();
      }
      if (attackerWP) {
        attackerWP.stats = attackerWP.stats || {};
        attackerWP.stats.gladiatorLosses = (attackerWP.stats.gladiatorLosses || 0) + 1;
        await attackerWP.save();
      }
    }

    res.json({
      success: true,
      result: {
        attackerWins:   result.attackerWins,
        attackerScore:  result.attackerScore,
        defenderScore:  result.defenderScore,
        damageDealt:    result.damageDealt,
        fatal:          result.fatal,
        xpGain:         result.xpGain,
        attackerGlad: {
          _id:          attackerGlad._id,
          name:         attackerGlad.name,
          level:        attackerGlad.level,
          health:       attackerGlad.health,
          maxHealth:    attackerGlad.maxHealth,
          battlePoints: attackerGlad.battlePoints,
          wins:         attackerGlad.wins,
          status:       attackerGlad.status,
        },
        defenderGlad: {
          _id:          defenderGlad._id,
          name:         defenderGlad.name,
          level:        defenderGlad.level,
          health:       defenderGlad.health,
          maxHealth:    defenderGlad.maxHealth,
          battlePoints: defenderGlad.battlePoints,
          losses:       defenderGlad.losses,
          status:       defenderGlad.status,
        },
      },
    });
  } catch (err) {
    console.error('Challenge error:', err);
    res.status(500).json({ error: '⚡ OMEN: The arena crumbles. The fight cannot proceed.' });
  }
};

exports.getVillageGladiators = async (req, res) => {
  try {
    const { villageID } = req.params;
    const VillageModel   = req.getVillageModel();
    const GladiatorModel = req.getGladiatorModel();

    const village = await VillageModel.findById(villageID).select('gladiators ownerId').lean();
    if (!village) return res.status(404).json({ error: 'Village not found.' });

    const gladiators = await GladiatorModel.find({
      _id: { $in: village.gladiators || [] },
      status: { $ne: 'Dead' },
    }).lean();

    res.json({ gladiators });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
