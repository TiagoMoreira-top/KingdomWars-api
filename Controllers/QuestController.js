const VillageService = require('../services/VillageService');
const QuestService = require('../services/QuestService');

/**
 * 📜 THE STEWARD'S DESK
 *
 * Read the chain, and claim a settled charge. Ownership is proven by the
 * `villageOwner` guard before either runs.
 */

exports.getQuests = async (req, res) => {
  try {
    const { villageId } = req.params;

    const village = await VillageService.getUpdatedVillage(villageId, req.world);
    if (!village) return res.status(404).json({ error: '🏰 MYSTERY: This land is not on our maps.' });

    // The crown's record is the only persisted part; read it fresh so a claim
    // made in another tab is reflected here.
    const WPModel = req.getWorldPlayerModel();
    const worldPlayer = await WPModel.findById(req.worldPlayer._id).lean();

    res.status(200).json({
      success: true,
      ...QuestService.getState(village, worldPlayer),
      serverTime: Date.now(),
    });
  } catch (error) {
    console.error('Quest State Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The steward has misplaced his ledger.' });
  }
};

exports.claimQuest = async (req, res) => {
  try {
    const { villageId } = req.params;
    const { questKey } = req.body;

    const villageModel = req.getVillageModel();
    const WPModel = req.getWorldPlayerModel();

    const village = await VillageService.getUpdatedVillage(villageId, req.world);
    if (!village) return res.status(404).json({ error: '🏰 MYSTERY: This land is not on our maps.' });

    const worldPlayer = await WPModel.findById(req.worldPlayer._id).lean();

    const check = QuestService.validateClaim(village, worldPlayer, questKey);
    if (!check.ok) return res.status(check.code || 400).json({ error: check.reason });

    const { quest, reward } = check;

    // 📜 Record the claim first, and only if it was not already recorded.
    // $addToSet with a matched filter means two simultaneous claims cannot
    // both pay out — the second modifies nothing and is refused below.
    const recorded = await WPModel.updateOne(
      { _id: req.worldPlayer._id, 'quests.claimed': { $ne: questKey } },
      { $addToSet: { 'quests.claimed': questKey } }
    );

    if (recorded.modifiedCount === 0) {
      return res.status(409).json({ error: '📜 PAID: This charge was settled already.' });
    }

    // 💰 Then pay. Resources respect warehouse capacity exactly like any other
    // income — a charge cannot overfill a full store.
    const cap = village.resources.maxStorage || Infinity;
    const goldCap = village.resources.maxGold ?? Infinity;

    const paid = {
      wood: Math.min(reward.wood || 0, Math.max(0, cap - village.resources.wood)),
      clay: Math.min(reward.clay || 0, Math.max(0, cap - village.resources.clay)),
      stone: Math.min(reward.stone || 0, Math.max(0, cap - village.resources.stone)),
      gold: Math.min(reward.gold || 0, Math.max(0, goldCap - village.resources.gold)),
    };

    await villageModel.updateOne(
      { _id: villageId },
      { $inc: {
        'resources.wood': paid.wood,
        'resources.clay': paid.clay,
        'resources.stone': paid.stone,
        'resources.gold': paid.gold,
      } }
    );

    const spilled = ['wood', 'clay', 'stone', 'gold']
      .filter(r => (reward[r] || 0) > paid[r]);

    res.status(200).json({
      success: true,
      message: `📜 SETTLED: "${quest.name}". The steward pays out.`,
      reward: paid,
      // Tell the lord plainly if their stores could not hold it all
      spilled: spilled.length ? spilled : undefined,
    });
  } catch (error) {
    console.error('Quest Claim Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The treasury refuses to open.' });
  }
};
