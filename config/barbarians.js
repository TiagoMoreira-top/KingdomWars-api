/**
 * 🪓 THE BARBARIANS
 *
 * Unclaimed holdings scattered across the realm. They exist so a new lord has
 * something to raid that is not another player — the opening quest chain asks
 * for a battle won, and without these the only answer is to attack a person
 * who will answer back.
 *
 * They are ordinary Village documents owned by a sentinel WorldPlayer, which
 * means every existing query, the map, combat resolution and reports all treat
 * them as villages without a single special case.
 *
 * They grow slowly and stop. Each holding is seeded with a `barbarianTier`
 * that caps how far it will ever develop, so the countryside ends up with a
 * spread of soft targets and a few genuinely dangerous ones.
 */

const BARBARIANS = {
  /**
   * 🛑 PAUSED. No new barbarian holdings are created while this is false —
   * not on boot, not on the four-hourly top-up, and not around a lord who
   * has just joined. Existing holdings are left exactly where they are.
   *
   * Set back to true to let the countryside fill again; nothing else needs
   * changing, and the crons pick themselves back up on the next restart.
   */
  SPAWNING_ENABLED: false,

  /**
   * Whether the holdings that already exist keep developing toward their
   * tier cap. Independent of spawning, so a paused countryside can either
   * stand still or carry on hardening.
   */
  GROWTH_ENABLED: true,

  /** The sentinel who nominally holds every barbarian village in a world. */
  OWNER_NAME: 'Barbarians',

  /** How many barbarian holdings a world should carry, at 1000×1000. */
  TARGET_COUNT: 260,

  /** Seeded around each new lord so their first raid is a short march. */
  NEIGHBOURS_ON_JOIN: 4,
  NEIGHBOUR_MIN_RADIUS: 4,
  NEIGHBOUR_MAX_RADIUS: 14,

  /**
   * Tier decides the ceiling a holding grows toward. Weighted so most of the
   * countryside stays raidable and only a few become real fortifications.
   */
  TIERS: [
    { tier: 1, weight: 34, capLevel: 3,  garrison: 12,  name: 'Abandoned Croft' },
    { tier: 2, weight: 28, capLevel: 6,  garrison: 45,  name: 'Barbarian Camp' },
    { tier: 3, weight: 20, capLevel: 10, garrison: 130, name: 'Raider Steading' },
    { tier: 4, weight: 12, capLevel: 15, garrison: 320, name: 'Warlord Hold' },
    { tier: 5, weight: 6,  capLevel: 20, garrison: 700, name: 'Barbarian Stronghold' },
  ],

  /** Structures a barbarian holding will raise, and nothing else. */
  GROWABLE: ['greatHall', 'woodFarm', 'clayFarm', 'stoneFarm', 'farm', 'warehouse', 'barracks', 'wall'],

  /** Troops they garrison. Defensive foot, with spears against horse. */
  GARRISON_MIX: [
    { unit: 'spearman', share: 0.45 },
    { unit: 'serf_levy', share: 0.30 },
    { unit: 'man_at_arms', share: 0.15 },
    { unit: 'archer', share: 0.10 },
  ],

  /** Chance per growth tick that a holding raises one structure by one level. */
  GROWTH_CHANCE: 0.35,

  /** How often the countryside stirs. */
  GROWTH_CRON: '17 * * * *',   // hourly, off the hour to avoid pile-ups
  SEED_CRON: '0 */4 * * *',    // top the world up every four hours
};

/** Pick a tier by weight from a [0,1) roll. */
function rollTier(roll) {
  const total = BARBARIANS.TIERS.reduce((a, t) => a + t.weight, 0);
  let n = roll * total;
  for (const t of BARBARIANS.TIERS) {
    n -= t.weight;
    if (n <= 0) return t;
  }
  return BARBARIANS.TIERS[0];
}

/** The garrison a holding of this tier and development should field. */
function garrisonFor(tier, level) {
  const t = BARBARIANS.TIERS.find(x => x.tier === tier) || BARBARIANS.TIERS[0];
  // Scale from a third of the target at level 1 to the full number at the cap
  const progress = t.capLevel > 1 ? Math.min(1, level / t.capLevel) : 1;
  const size = Math.floor(t.garrison * (0.33 + 0.67 * progress));

  const army = {};
  for (const { unit, share } of BARBARIANS.GARRISON_MIX) {
    const n = Math.floor(size * share);
    if (n > 0) army[unit] = n;
  }
  return army;
}

module.exports = { BARBARIANS, rollTier, garrisonFor };
