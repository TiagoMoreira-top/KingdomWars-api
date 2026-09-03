const { ITEMS, RELIC_SLOTS } = require('../config/items');

/**
 * 🎒 THE LORD'S BAGGAGE
 *
 * Owning, wearing, and spending items. Bonuses reach the game through exactly
 * one door: `multipliers()` returns the same shape as the king's tree, and the
 * two are summed in KingService.multipliers. That means an item's effect lands
 * in production, storage, build time, attack, defence, loot and hospital with
 * no consumer needing to know items exist.
 *
 * Nothing here is stored that can be derived. Active boosts keep an expiry and
 * are filtered on read, so a lapsed boost stops applying the moment it lapses
 * whether or not anything has pruned it.
 */

/** Effect keys the engine actually reads. Anything else is a bonus that lies. */
const LIVE_KEYS = new Set([
  'attackBonus', 'defenseBonus', 'productionBonus', 'storageBonus',
  'buildTimeReduction', 'buildCostReduction', 'hospitalBonus',
  'speedBonus', 'lootBonus', 'dragonBonus', 'godKingBonus',
]);

// Fail loudly at boot rather than ship an item that grants nothing.
for (const [key, item] of Object.entries(ITEMS)) {
  if (!LIVE_KEYS.has(item.effect?.key)) {
    throw new Error(
      `🎒 CATALOGUE ERROR: "${key}" grants "${item.effect?.key}", which the engine never reads.`
    );
  }
  if (item.type === 'consumable' && !item.durationMs) {
    throw new Error(`🎒 CATALOGUE ERROR: consumable "${key}" has no durationMs.`);
  }
}

const emptyBag = () => ({
  attackBonus: 0, defenseBonus: 0, productionBonus: 0, storageBonus: 0,
  buildTimeReduction: 0, buildCostReduction: 0, hospitalBonus: 0,
  speedBonus: 0, lootBonus: 0, dragonBonus: 0, godKingBonus: 0,
});

const InventoryService = {
  RELIC_SLOTS,

  /** How many of `itemKey` this lord is holding, unequipped and unused. */
  held(worldPlayer, itemKey) {
    const row = (worldPlayer?.inventory || []).find(i => i.itemKey === itemKey);
    return row?.qty || 0;
  },

  equipped(worldPlayer) {
    return (worldPlayer?.equipped || []).filter(k => ITEMS[k]?.type === 'relic');
  },

  /** Boosts that have not yet lapsed. Filtered on read, never trusted stored. */
  activeBoosts(worldPlayer, now = Date.now()) {
    return (worldPlayer?.activeBoosts || []).filter(b => b && b.expiresAt > now);
  },

  /**
   * 🔑 THE ONE DOOR.
   *
   * Equipped relics and unlapsed boosts, summed into the same bag the king's
   * tree produces. KingService adds this to its own total, so every consumer
   * already reads it.
   */
  multipliers(worldPlayer, now = Date.now()) {
    const bag = emptyBag();
    if (!worldPlayer) return bag;

    for (const key of this.equipped(worldPlayer)) {
      const item = ITEMS[key];
      if (item && bag[item.effect.key] !== undefined) bag[item.effect.key] += item.effect.value;
    }

    for (const boost of this.activeBoosts(worldPlayer, now)) {
      const item = ITEMS[boost.itemKey];
      if (item && bag[item.effect.key] !== undefined) bag[item.effect.key] += item.effect.value;
    }

    return bag;
  },

  /* ── Validation. The controller performs the writes. ────────────────── */

  validateBuy(worldPlayer, village, itemKey, qty = 1) {
    const item = ITEMS[itemKey];
    if (!item) return { ok: false, code: 400, reason: '🎒 UNKNOWN: The merchant carries no such thing.' };

    const n = Math.max(1, Math.min(10, Math.floor(qty) || 1));
    const cost = item.price * n;

    if ((village?.resources?.gold || 0) < cost) {
      return {
        ok: false, code: 402,
        reason: `🪙 POVERTY: That costs ${cost} gold. Thou hast ${Math.floor(village?.resources?.gold || 0)}.`,
      };
    }

    // A second copy of a relic would sit in the bag doing nothing — only one of
    // each can ever be worn, so selling a duplicate would be taking coin for air.
    if (item.type === 'relic') {
      if (n > 1) return { ok: false, code: 400, reason: '🎒 ONE ONLY: A relic is bought singly.' };
      if (this.held(worldPlayer, itemKey) > 0 || this.equipped(worldPlayer).includes(itemKey)) {
        return { ok: false, code: 409, reason: `🎒 ALREADY THINE: Thou ownest ${item.name}.` };
      }
    }

    return { ok: true, item, qty: n, cost };
  },

  validateEquip(worldPlayer, itemKey) {
    const item = ITEMS[itemKey];
    if (!item) return { ok: false, code: 400, reason: '🎒 UNKNOWN: No such item.' };
    if (item.type !== 'relic') return { ok: false, code: 400, reason: '🎒 NOT A RELIC: Only relics are worn.' };
    if (this.held(worldPlayer, itemKey) < 1) return { ok: false, code: 404, reason: '🎒 UNOWNED: It is not in thy baggage.' };

    const worn = this.equipped(worldPlayer);
    if (worn.includes(itemKey)) return { ok: false, code: 409, reason: '🎒 WORN: Already carried.' };
    if (worn.length >= RELIC_SLOTS) {
      return {
        ok: false, code: 403,
        reason: `🎒 BURDENED: A lord bears ${RELIC_SLOTS} relics. Set one aside first.`,
      };
    }
    return { ok: true, item };
  },

  validateUnequip(worldPlayer, itemKey) {
    if (!this.equipped(worldPlayer).includes(itemKey)) {
      return { ok: false, code: 404, reason: '🎒 NOT WORN: That relic is not carried.' };
    }
    return { ok: true, item: ITEMS[itemKey] };
  },

  validateUse(worldPlayer, itemKey, now = Date.now()) {
    const item = ITEMS[itemKey];
    if (!item) return { ok: false, code: 400, reason: '🎒 UNKNOWN: No such item.' };
    if (item.type !== 'consumable') return { ok: false, code: 400, reason: '🎒 NOT CONSUMABLE: A relic is worn, not spent.' };
    if (this.held(worldPlayer, itemKey) < 1) return { ok: false, code: 404, reason: '🎒 UNOWNED: It is not in thy baggage.' };

    // Stacking the same boost would let a lord burn ten at once for ten times
    // the effect. One at a time; the running one must lapse first.
    if (this.activeBoosts(worldPlayer, now).some(b => b.itemKey === itemKey)) {
      return { ok: false, code: 409, reason: `🎒 ALREADY RUNNING: ${item.name} is still in effect.` };
    }

    return { ok: true, item, expiresAt: now + item.durationMs };
  },

  /** Everything the shop and bag screens need, in one shape. */
  getState(worldPlayer, village, now = Date.now()) {
    const worn = this.equipped(worldPlayer);
    const boosts = this.activeBoosts(worldPlayer, now);

    return {
      catalogue: Object.values(ITEMS).map(item => ({
        ...item,
        owned: this.held(worldPlayer, item.key),
        isEquipped: worn.includes(item.key),
        isActive: boosts.some(b => b.itemKey === item.key),
      })),
      inventory: (worldPlayer?.inventory || []).filter(i => i.qty > 0),
      equipped: worn,
      activeBoosts: boosts.map(b => ({ ...b.toObject?.() || b, name: ITEMS[b.itemKey]?.name })),
      relicSlots: RELIC_SLOTS,
      slotsUsed: worn.length,
      gold: Math.floor(village?.resources?.gold || 0),
      multipliers: this.multipliers(worldPlayer, now),
    };
  },
};

module.exports = InventoryService;
