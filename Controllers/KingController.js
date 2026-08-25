const KingService = require('../services/KingService');
const { NODES } = require('../config/kingTree');

/**
 * 👑 THE CROWN'S COUNCIL
 *
 * Read the tree, invest a point, or renounce everything and begin again.
 * The crown belongs to the player, not a village, so these hang off the world
 * rather than behind the village-ownership guard.
 */

exports.getTree = async (req, res) => {
  try {
    const WPModel = req.getWorldPlayerModel();
    const crown = await WPModel.findById(req.worldPlayer._id).lean();
    if (!crown) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    res.status(200).json({ success: true, ...KingService.getState(crown) });
  } catch (error) {
    console.error('King Tree Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The heralds cannot read the crown\'s ledger.' });
  }
};

exports.spendPoint = async (req, res) => {
  try {
    const { nodeKey } = req.body;
    const WPModel = req.getWorldPlayerModel();

    const crown = await WPModel.findById(req.worldPlayer._id).lean();
    if (!crown) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    const check = KingService.validateSpend(crown, nodeKey);
    if (!check.ok) return res.status(check.code || 400).json({ error: check.reason });

    // Guarded write: the filter re-checks affordability against the stored
    // list, so two rapid clicks cannot both spend the same last point.
    const spentNow = (crown.kingNodes || [])
      .reduce((a, k) => a + (NODES[k]?.costPerRank || 0), 0);

    const updated = await WPModel.findOneAndUpdate(
      { _id: req.worldPlayer._id, $expr: { $eq: [{ $size: { $ifNull: ['$kingNodes', []] } }, (crown.kingNodes || []).length] } },
      { $push: { kingNodes: nodeKey } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(409).json({ error: '👑 CONTESTED: The council moved while thou wert deciding. Try again.' });
    }

    res.status(200).json({
      success: true,
      message: `👑 INVESTED: "${check.node.name}" deepens.`,
      spentBefore: spentNow,
      ...KingService.getState(updated),
    });
  } catch (error) {
    console.error('King Spend Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The council cannot record thy decree.' });
  }
};

/**
 * Renounce every calling and reclaim the points. Costs gold, drawn from the
 * lord's first village, so rethinking a build is possible but never free.
 */
exports.respec = async (req, res) => {
  try {
    const WPModel = req.getWorldPlayerModel();
    const VillageModel = req.getVillageModel();

    const crown = await WPModel.findById(req.worldPlayer._id).lean();
    if (!crown) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    const held = (crown.kingNodes || []).length;
    if (held === 0) {
      return res.status(400).json({ error: '👑 UNSPENT: There is nothing to renounce.' });
    }

    // 200 gold per rank held — cheap early, expensive once committed
    const cost = held * 200;
    const village = await VillageModel.findOne({ ownerId: req.worldPlayer._id });
    if (!village) return res.status(404).json({ error: '🏰 LANDLESS: Thou holdest no village to pay from.' });

    if ((village.resources.gold || 0) < cost) {
      return res.status(402).json({
        error: `🪙 POVERTY: Renouncing ${held} calling(s) costs ${cost} gold. Thou hast ${Math.floor(village.resources.gold || 0)}.`,
      });
    }

    await VillageModel.updateOne({ _id: village._id }, { $inc: { 'resources.gold': -cost } });
    const updated = await WPModel.findByIdAndUpdate(
      req.worldPlayer._id, { $set: { kingNodes: [] } }, { new: true }
    ).lean();

    res.status(200).json({
      success: true,
      message: `👑 RENOUNCED: ${held} calling(s) set aside for ${cost} gold. Choose anew.`,
      goldSpent: cost,
      ...KingService.getState(updated),
    });
  } catch (error) {
    console.error('King Respec Error:', error);
    res.status(500).json({ error: '⚡ OMEN: The council refuses to strike the record.' });
  }
};
