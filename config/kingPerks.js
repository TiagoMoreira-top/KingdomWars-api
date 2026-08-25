// Passive perks unlocked at each king level (1-based, index 0 = level 1 = no perk)
const KING_PERKS = [
  null, // Level 1 — starting point
  { level: 2,  category: 'economy',  key: 'productionBonus',   value: 0.05,  label: '+5% Resource Production',    icon: '🌾' },
  { level: 3,  category: 'military', key: 'attackBonus',       value: 0.05,  label: '+5% Troop Attack',            icon: '⚔️' },
  { level: 4,  category: 'defense',  key: 'hospitalBonus',     value: 0.10,  label: '+10% Hospital Survival',      icon: '🏥' },
  { level: 5,  category: 'defense',  key: 'defenseBonus',      value: 0.05,  label: '+5% Troop Defense',           icon: '🛡️' },
  { level: 6,  category: 'economy',  key: 'storageBonus',      value: 0.10,  label: '+10% Resource Storage',       icon: '🏚️' },
  { level: 7,  category: 'military', key: 'attackBonus',       value: 0.10,  label: '+10% Troop Attack',           icon: '⚔️' },
  { level: 8,  category: 'military', key: 'speedBonus',        value: 0.05,  label: '+5% March Speed',             icon: '🏇' },
  { level: 9,  category: 'economy',  key: 'productionBonus',   value: 0.10,  label: '+10% Resource Production',    icon: '🌾' },
  { level: 10, category: 'defense',  key: 'defenseBonus',      value: 0.10,  label: '+10% Troop Defense',          icon: '🛡️' },
  { level: 11, category: 'military', key: 'lootBonus',         value: 0.05,  label: '+5% Loot Capacity',           icon: '💰' },
  { level: 12, category: 'military', key: 'attackBonus',       value: 0.15,  label: '+15% Troop Attack',           icon: '⚔️' },
  { level: 13, category: 'economy',  key: 'buildTimeReduction',value: 0.15,  label: '−15% Build Time',             icon: '🔨' },
  { level: 14, category: 'defense',  key: 'defenseBonus',      value: 0.15,  label: '+15% Troop Defense',          icon: '🛡️' },
  { level: 15, category: 'economy',  key: 'productionBonus',   value: 0.15,  label: '+15% Resource Production',    icon: '🌾' },
  { level: 16, category: 'military', key: 'attackBonus',       value: 0.20,  label: '+20% Troop Attack',           icon: '⚔️' },
  { level: 17, category: 'military', key: 'dragonBonus',       value: 0.05,  label: '+5% Dragon Stats',            icon: '🐉' },
  { level: 18, category: 'defense',  key: 'defenseBonus',      value: 0.20,  label: '+20% Troop Defense',          icon: '🛡️' },
  { level: 19, category: 'economy',  key: 'buildTimeReduction',value: 0.25,  label: '−25% Build Time',             icon: '🔨' },
  { level: 20, category: 'military', key: 'godKingBonus',      value: 0.30,  label: '+30% Attack & Defense',       icon: '👑' },
];

/**
 * Returns cumulative perk multipliers for a given king level.
 * All bonuses stack additively.
 */
/**
 * 👑 Cumulative multipliers for a king.
 *
 * The tree replaced the automatic ladder: bonuses now come from nodes the
 * lord chose, not from the level alone. Pass the WorldPlayer (or anything
 * carrying `kingNodes`) to resolve them.
 *
 * Called with a bare number — the old signature — it returns a zeroed set,
 * because a king who has spent no points has earned no bonuses.
 */
function getPerkMultipliers(playerOrLevel) {
  const KingService = require('../services/KingService');
  const player = (playerOrLevel && typeof playerOrLevel === 'object')
    ? playerOrLevel
    : { kingLevel: playerOrLevel || 1, kingNodes: [] };
  return KingService.multipliers(player);
}

module.exports = { KING_PERKS, getPerkMultipliers };
