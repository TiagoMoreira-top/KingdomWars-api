/**
 * 🎒 THE MERCHANT'S STOCK
 *
 * Two kinds of thing a lord can own:
 *
 *   RELIC      permanent, but only a few may be worn at once. Which bonuses a
 *              lord runs is a standing choice, the same shape of decision the
 *              king's tree asks — you cannot wear everything.
 *
 *   CONSUMABLE used once for a burst that expires. No slot cost, but it is gone
 *              afterwards, so it is spent on a moment that matters.
 *
 * EFFECT KEYS ARE NOT FREE-FORM. Every `effect.key` below must be one the
 * engine already reads through getPerkMultipliers — that bag is consumed by
 * ResourceService (production, storage), VillageController (build time) and
 * MissionService (attack, defence, loot, hospital). A key outside that set
 * would sell a bonus that silently does nothing, so InventoryService validates
 * the whole catalogue against it on load.
 */

/** How many relics a lord may wear at once. */
const RELIC_SLOTS = 3;

const ITEMS = {
  /* ══════════ RELICS — permanent, slot-limited ══════════ */
  harvest_horn: {
    key: 'harvest_horn', type: 'relic', tier: 1, price: 1200,
    name: 'The Harvest Horn',
    description: 'Sounded at first light. The fields answer.',
    effect: { key: 'productionBonus', value: 0.08 },
  },
  deep_cellar_key: {
    key: 'deep_cellar_key', type: 'relic', tier: 1, price: 1000,
    name: 'Key to the Deep Cellar',
    description: 'Somewhere under the keep there is more room than anyone admits.',
    effect: { key: 'storageBonus', value: 0.12 },
  },
  whetstone_of_kings: {
    key: 'whetstone_of_kings', type: 'relic', tier: 2, price: 2200,
    name: 'The Whetstone of Kings',
    description: 'Every blade in the muster has touched this stone.',
    effect: { key: 'attackBonus', value: 0.10 },
  },
  oathbound_shield: {
    key: 'oathbound_shield', type: 'relic', tier: 2, price: 2200,
    name: 'The Oathbound Shield',
    description: 'Carried by three defenders of the gate. None of them fell.',
    effect: { key: 'defenseBonus', value: 0.10 },
  },
  masons_plumb: {
    key: 'masons_plumb', type: 'relic', tier: 2, price: 1800,
    name: "The Mason's Plumb",
    description: 'Dead straight, and it has never once been wrong.',
    effect: { key: 'buildTimeReduction', value: 0.10 },
  },
  surgeons_satchel: {
    key: 'surgeons_satchel', type: 'relic', tier: 2, price: 1600,
    name: "The Surgeon's Satchel",
    description: 'Most of the dying happens after the fighting stops. Not here.',
    effect: { key: 'hospitalBonus', value: 0.15 },
  },
  raiders_tally: {
    key: 'raiders_tally', type: 'relic', tier: 3, price: 3000,
    name: "The Raider's Tally",
    description: 'A running count of everything ever carried home.',
    effect: { key: 'lootBonus', value: 0.15 },
  },

  /* ══════════ CONSUMABLES — a burst, then gone ══════════ */
  feast_of_plenty: {
    key: 'feast_of_plenty', type: 'consumable', tier: 1, price: 400,
    name: 'Feast of Plenty',
    description: 'Full bellies work harder. For a while.',
    effect: { key: 'productionBonus', value: 0.25 },
    durationMs: 4 * 60 * 60 * 1000,
  },
  war_drums: {
    key: 'war_drums', type: 'consumable', tier: 2, price: 700,
    name: 'War Drums',
    description: 'They can be heard three valleys off, and they do not stop.',
    effect: { key: 'attackBonus', value: 0.20 },
    durationMs: 2 * 60 * 60 * 1000,
  },
  shield_wall_oath: {
    key: 'shield_wall_oath', type: 'consumable', tier: 2, price: 700,
    name: 'The Shield-Wall Oath',
    description: 'Sworn at dusk, held until dawn.',
    effect: { key: 'defenseBonus', value: 0.20 },
    durationMs: 2 * 60 * 60 * 1000,
  },
  double_shift: {
    key: 'double_shift', type: 'consumable', tier: 1, price: 500,
    name: 'The Double Shift',
    description: 'Nobody sleeps until the course is laid.',
    effect: { key: 'buildTimeReduction', value: 0.25 },
    durationMs: 6 * 60 * 60 * 1000,
  },
};

/** Rough guide for the shop's ordering and colouring. */
const TIER_NAMES = { 1: 'Common', 2: 'Fine', 3: 'Rare' };

module.exports = { ITEMS, RELIC_SLOTS, TIER_NAMES };
