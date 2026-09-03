const InventoryService = require('../services/InventoryService');
const { ITEMS } = require('../config/items');

/**
 * 🎒 THE MERCHANT AND THE BAGGAGE
 *
 * Buying, wearing, and spending. The baggage belongs to the lord rather than to
 * any one village, so these hang off the world — but gold is a village's, and
 * is drawn from the lord's first holding, the same place a respec is paid from.
 *
 * Every write that spends something is guarded in its filter rather than
 * checked and then written, so two quick clicks cannot buy one item twice.
 */

async function payingVillage(req) {
  const VillageModel = req.getVillageModel();
  return VillageModel.findOne({ ownerId: req.worldPlayer._id });
}

exports.getInventory = async (req, res) => {
  try {
    const WPModel = req.getWorldPlayerModel();
    const lord = await WPModel.findById(req.worldPlayer._id).lean();
    if (!lord) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    const village = await payingVillage(req);
    res.json({ success: true, ...InventoryService.getState(lord, village) });
  } catch (err) {
    console.error('Inventory Error:', err);
    res.status(500).json({ error: '⚡ OMEN: The quartermaster cannot find the ledger.' });
  }
};

exports.buy = async (req, res) => {
  try {
    const { itemKey, qty } = req.body;
    const WPModel = req.getWorldPlayerModel();
    const VillageModel = req.getVillageModel();

    const lord = await WPModel.findById(req.worldPlayer._id).lean();
    if (!lord) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    const village = await payingVillage(req);
    if (!village) return res.status(404).json({ error: '🏰 LANDLESS: Thou holdest no village to pay from.' });

    const check = InventoryService.validateBuy(lord, village, itemKey, qty);
    if (!check.ok) return res.status(check.code || 400).json({ error: check.reason });

    // Guarded: the gold condition lives in the filter, so a second click that
    // arrives before the first has settled finds nothing to update.
    const paid = await VillageModel.updateOne(
      { _id: village._id, 'resources.gold': { $gte: check.cost } },
      { $inc: { 'resources.gold': -check.cost } }
    );
    if (!paid.modifiedCount) {
      return res.status(409).json({ error: '🪙 CONTESTED: The coin was spent elsewhere. Try again.' });
    }

    // Stack onto an existing row if there is one, otherwise start a row.
    const has = (lord.inventory || []).some(i => i.itemKey === itemKey);
    const updated = has
      ? await WPModel.findOneAndUpdate(
          { _id: lord._id, 'inventory.itemKey': itemKey },
          { $inc: { 'inventory.$.qty': check.qty } },
          { new: true }
        ).lean()
      : await WPModel.findOneAndUpdate(
          { _id: lord._id },
          { $push: { inventory: { itemKey, qty: check.qty } } },
          { new: true }
        ).lean();

    const after = await payingVillage(req);
    res.status(201).json({
      success: true,
      message: `🎒 BOUGHT: ${check.item.name}${check.qty > 1 ? ` ×${check.qty}` : ''} for ${check.cost} gold.`,
      ...InventoryService.getState(updated, after),
    });
  } catch (err) {
    console.error('Inventory Buy Error:', err);
    res.status(500).json({ error: '⚡ OMEN: The merchant will not take thy coin.' });
  }
};

exports.equip = async (req, res) => {
  try {
    const { itemKey } = req.body;
    const WPModel = req.getWorldPlayerModel();

    const lord = await WPModel.findById(req.worldPlayer._id).lean();
    if (!lord) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    const check = InventoryService.validateEquip(lord, itemKey);
    if (!check.ok) return res.status(check.code || 400).json({ error: check.reason });

    // $addToSet, so a double click cannot wear the same relic twice.
    const updated = await WPModel.findOneAndUpdate(
      { _id: lord._id },
      { $addToSet: { equipped: itemKey } },
      { new: true }
    ).lean();

    const village = await payingVillage(req);
    res.json({
      success: true,
      message: `🎒 BORNE: ${check.item.name} is carried.`,
      ...InventoryService.getState(updated, village),
    });
  } catch (err) {
    console.error('Inventory Equip Error:', err);
    res.status(500).json({ error: '⚡ OMEN: The relic will not be taken up.' });
  }
};

exports.unequip = async (req, res) => {
  try {
    const { itemKey } = req.body;
    const WPModel = req.getWorldPlayerModel();

    const lord = await WPModel.findById(req.worldPlayer._id).lean();
    if (!lord) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    const check = InventoryService.validateUnequip(lord, itemKey);
    if (!check.ok) return res.status(check.code || 400).json({ error: check.reason });

    // Setting a relic aside returns it to the baggage; it is not destroyed.
    const updated = await WPModel.findOneAndUpdate(
      { _id: lord._id },
      { $pull: { equipped: itemKey } },
      { new: true }
    ).lean();

    const village = await payingVillage(req);
    res.json({
      success: true,
      message: `🎒 SET ASIDE: ${check.item?.name || itemKey} returns to thy baggage.`,
      ...InventoryService.getState(updated, village),
    });
  } catch (err) {
    console.error('Inventory Unequip Error:', err);
    res.status(500).json({ error: '⚡ OMEN: The relic will not be set down.' });
  }
};

exports.use = async (req, res) => {
  try {
    const { itemKey } = req.body;
    const WPModel = req.getWorldPlayerModel();

    const lord = await WPModel.findById(req.worldPlayer._id).lean();
    if (!lord) return res.status(404).json({ error: '👑 UNCROWNED: No such lord in this realm.' });

    const check = InventoryService.validateUse(lord, itemKey);
    if (!check.ok) return res.status(check.code || 400).json({ error: check.reason });

    // Guarded on the quantity still being there, so the same charge cannot be
    // spent twice by two requests arriving together.
    const spent = await WPModel.updateOne(
      { _id: lord._id, inventory: { $elemMatch: { itemKey, qty: { $gte: 1 } } } },
      { $inc: { 'inventory.$.qty': -1 } }
    );
    if (!spent.modifiedCount) {
      return res.status(409).json({ error: '🎒 CONTESTED: That charge was already spent. Try again.' });
    }

    const updated = await WPModel.findOneAndUpdate(
      { _id: lord._id },
      { $push: { activeBoosts: { itemKey, expiresAt: check.expiresAt } } },
      { new: true }
    ).lean();

    const hours = Math.round(check.item.durationMs / 3600000);
    const village = await payingVillage(req);
    res.json({
      success: true,
      message: `🎒 SPENT: ${check.item.name} takes hold for ${hours}h.`,
      ...InventoryService.getState(updated, village),
    });
  } catch (err) {
    console.error('Inventory Use Error:', err);
    res.status(500).json({ error: '⚡ OMEN: The charge will not take.' });
  }
};
