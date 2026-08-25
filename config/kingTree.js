/**
 * 👑 THE CROWN'S TREE
 *
 * The old perk ladder handed out every bonus automatically as the king levelled,
 * so two kings of the same level were identical. This replaces it with points
 * the lord spends deliberately.
 *
 * THE CONSTRAINT THAT MAKES IT A CHOICE: a king at the maximum level 20 earns
 * 23 points. The tree costs 67 to fill, and a single branch costs 22-23. So the
 * decision is real: crown one calling completely, or spread across two and
 * crown nothing. Two full branches would need 44 and can never happen.
 *
 * Capstones are mutually exclusive. Exactly one crown, ever.
 */

const BRANCHES = {
  prosperity: {
    key: 'prosperity',
    name: 'Prosperity',
    epithet: 'The Full Granary',
    description: 'Kings remembered for what they built rather than what they burned.',
    colour: '#d4af37',
  },
  war: {
    key: 'war',
    name: 'War',
    epithet: 'The Drawn Sword',
    description: 'The shortest road to a neighbour\'s storehouse runs through their wall.',
    colour: '#c1502e',
  },
  bulwark: {
    key: 'bulwark',
    name: 'Bulwark',
    epithet: 'The Standing Wall',
    description: 'A holding that cannot be taken need never be retaken.',
    colour: '#4fa88a',
  },
};

/**
 * NODE CONTRACT
 *   tier         1..3, plus 4 for capstones. A tier is locked until you have
 *                spent `tierGate` points in that branch.
 *   ranks        how many times it may be taken
 *   costPerRank  points per rank
 *   effect       { key, value } — value is PER RANK, and `key` must be one the
 *                engine already reads (see getPerkMultipliers).
 */
const NODES = {
  /* ══════════ PROSPERITY ══════════ */
  tilled_fields: {
    key: 'tilled_fields', branch: 'prosperity', tier: 1, ranks: 3, costPerRank: 1,
    name: 'Tilled Fields', requires: [],
    description: 'Rotate the strips and drain the low ground.',
    effect: { key: 'productionBonus', value: 0.05 },
  },
  deep_stores: {
    key: 'deep_stores', branch: 'prosperity', tier: 1, ranks: 3, costPerRank: 1,
    name: 'Deep Stores', requires: [],
    description: 'Cellars cut below the frost line.',
    effect: { key: 'storageBonus', value: 0.08 },
  },
  master_masons: {
    key: 'master_masons', branch: 'prosperity', tier: 2, ranks: 3, costPerRank: 2,
    name: 'Master Masons', requires: ['tilled_fields'],
    description: 'Crews who have built the same wall a hundred times.',
    effect: { key: 'buildTimeReduction', value: 0.08 },
  },
  royal_charter: {
    key: 'royal_charter', branch: 'prosperity', tier: 3, ranks: 2, costPerRank: 3,
    name: 'Royal Charter', requires: ['master_masons'],
    description: 'The guilds answer to the crown, and price accordingly.',
    effect: { key: 'buildCostReduction', value: 0.07 },
  },
  golden_age: {
    key: 'golden_age', branch: 'prosperity', tier: 4, ranks: 1, costPerRank: 5,
    name: 'A Golden Age', requires: ['royal_charter'], capstone: true,
    description: 'They will name the century after thee, and forget the wars entirely.',
    effect: { key: 'productionBonus', value: 0.25 },
  },

  /* ══════════ WAR ══════════ */
  drillmasters: {
    key: 'drillmasters', branch: 'war', tier: 1, ranks: 3, costPerRank: 1,
    name: 'Drillmasters', requires: [],
    description: 'Two hours on the sand before anyone eats.',
    effect: { key: 'attackBonus', value: 0.05 },
  },
  baggage_train: {
    key: 'baggage_train', branch: 'war', tier: 1, ranks: 2, costPerRank: 1,
    name: 'Baggage Train', requires: [],
    description: 'More carts means more comes home.',
    effect: { key: 'lootBonus', value: 0.1 },
  },
  forced_march: {
    key: 'forced_march', branch: 'war', tier: 2, ranks: 3, costPerRank: 2,
    name: 'Forced March', requires: ['drillmasters'],
    description: 'Sleep is a luxury of garrison duty.',
    effect: { key: 'speedBonus', value: 0.07 },
  },
  siegecraft: {
    key: 'siegecraft', branch: 'war', tier: 3, ranks: 2, costPerRank: 3,
    name: 'Siegecraft', requires: ['forced_march'],
    description: 'Every wall has a course laid wrong. Find it.',
    effect: { key: 'attackBonus', value: 0.1 },
  },
  the_conqueror: {
    key: 'the_conqueror', branch: 'war', tier: 4, ranks: 1, costPerRank: 5,
    name: 'The Conqueror', requires: ['siegecraft'], capstone: true,
    description: 'Borders are a matter of opinion, and thine is the loudest.',
    effect: { key: 'attackBonus', value: 0.25 },
  },

  /* ══════════ BULWARK ══════════ */
  shield_drill: {
    key: 'shield_drill', branch: 'bulwark', tier: 1, ranks: 3, costPerRank: 1,
    name: 'Shield Drill', requires: [],
    description: 'Overlap, brace, and do not look at what is coming.',
    effect: { key: 'defenseBonus', value: 0.05 },
  },
  field_surgeons: {
    key: 'field_surgeons', branch: 'bulwark', tier: 1, ranks: 2, costPerRank: 1,
    name: 'Field Surgeons', requires: [],
    description: 'Most of the dying is done after the fighting stops.',
    effect: { key: 'hospitalBonus', value: 0.12 },
  },
  deep_foundations: {
    key: 'deep_foundations', branch: 'bulwark', tier: 2, ranks: 3, costPerRank: 2,
    name: 'Deep Foundations', requires: ['shield_drill'],
    description: 'A wall is only as good as what it stands on.',
    effect: { key: 'defenseBonus', value: 0.07 },
  },
  stubborn_ground: {
    key: 'stubborn_ground', branch: 'bulwark', tier: 3, ranks: 2, costPerRank: 3,
    name: 'Stubborn Ground', requires: ['deep_foundations'],
    description: 'They will take it. It will cost them everything they brought.',
    effect: { key: 'defenseBonus', value: 0.1 },
  },
  the_unbroken: {
    key: 'the_unbroken', branch: 'bulwark', tier: 4, ranks: 1, costPerRank: 5,
    name: 'The Unbroken', requires: ['stubborn_ground'], capstone: true,
    description: 'Three sieges. Three winters. The same banner.',
    effect: { key: 'defenseBonus', value: 0.25 },
  },
};

/** Points needed in a branch before each tier opens. */
const TIER_GATES = { 1: 0, 2: 3, 3: 7, 4: 11 };

/**
 * One point per level, plus a bonus point every fifth level.
 *
 * Tuned so a king at the cap earns 23 — enough to complete exactly ONE branch
 * including its capstone, and nowhere near the 67 the full tree costs. That is
 * the decision: go deep in one calling, or spread wide and crown nothing.
 */
const pointsForLevel = (kingLevel) => {
  const lvl = kingLevel || 1;
  return Math.max(0, (lvl - 1) + Math.floor(lvl / 5));
};

/** What a full tree would cost — used to prove the constraint holds. */
function totalTreeCost() {
  return Object.values(NODES).reduce((a, n) => a + n.ranks * n.costPerRank, 0);
}

/** Cost of a branch, in full. */
function branchCost(branchKey) {
  return Object.values(NODES)
    .filter(n => n.branch === branchKey)
    .reduce((a, n) => a + n.ranks * n.costPerRank, 0);
}

module.exports = { BRANCHES, NODES, TIER_GATES, pointsForLevel, totalTreeCost, branchCost };
