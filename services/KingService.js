const { BRANCHES, NODES, TIER_GATES, pointsForLevel } = require('../config/kingTree');

/**
 * 👑 THE CROWN
 *
 * Resolves a king's chosen nodes into the same multiplier shape the engine has
 * always consumed, so combat, production and construction need no knowledge of
 * the tree at all — they keep asking for multipliers and get them.
 *
 * Choices are stored as a flat list of node keys, repeated once per rank. That
 * makes spending an append, refunding a filter, and counting a reduce; there is
 * no separate rank table to fall out of step.
 */

/** Every multiplier the engine reads, at zero. */
const emptyMultipliers = () => ({
  attackBonus: 0,
  defenseBonus: 0,
  productionBonus: 0,
  storageBonus: 0,
  buildTimeReduction: 0,
  buildCostReduction: 0,
  hospitalBonus: 0,
  speedBonus: 0,
  lootBonus: 0,
  dragonBonus: 0,
  godKingBonus: 0,
});

/** How many ranks of a node are held. */
const ranksOf = (chosen, key) => (chosen || []).filter(k => k === key).length;

const KingService = {
  /** Points earned, spent and remaining. */
  budget(worldPlayer) {
    const earned = pointsForLevel(worldPlayer?.kingLevel || 1);
    const chosen = worldPlayer?.kingNodes || [];
    const spent = chosen.reduce((a, key) => a + (NODES[key]?.costPerRank || 0), 0);
    return { earned, spent, available: Math.max(0, earned - spent) };
  },

  /** Points spent within a single branch — what the tier gates measure. */
  spentInBranch(chosen, branchKey) {
    return (chosen || []).reduce((a, key) => {
      const n = NODES[key];
      return a + (n && n.branch === branchKey ? n.costPerRank : 0);
    }, 0);
  },

  /**
   * Turn chosen nodes into engine multipliers. This is the function that
   * replaces the old automatic ladder.
   */
  multipliers(worldPlayer) {
    const m = emptyMultipliers();
    for (const key of (worldPlayer?.kingNodes || [])) {
      const node = NODES[key];
      if (!node) continue;
      if (m[node.effect.key] === undefined) continue;
      m[node.effect.key] += node.effect.value;
    }

    // 🎒 Relics worn and boosts still running stack on top of the tree.
    // Required here rather than at module load to avoid a require cycle.
    const InventoryService = require('./InventoryService');
    const bag = InventoryService.multipliers(worldPlayer);
    for (const [k, v] of Object.entries(bag)) {
      if (m[k] !== undefined) m[k] += v;
    }
    return m;
  },

  /** Why a node can or cannot be taken right now. */
  nodeState(worldPlayer, node) {
    const chosen = worldPlayer?.kingNodes || [];
    const { available } = this.budget(worldPlayer);
    const rank = ranksOf(chosen, node.key);
    const maxed = rank >= node.ranks;

    const branchSpent = this.spentInBranch(chosen, node.branch);
    const gate = TIER_GATES[node.tier] ?? 0;
    const gateMet = branchSpent >= gate;

    const missingReqs = (node.requires || []).filter(r => ranksOf(chosen, r) === 0);

    // Exactly one crown, ever.
    const otherCapstone = node.capstone && Object.values(NODES)
      .some(n => n.capstone && n.key !== node.key && ranksOf(chosen, n.key) > 0);

    const affordable = available >= node.costPerRank;

    return {
      rank,
      maxed,
      gateMet,
      gateNeeded: gate,
      branchSpent,
      missingReqs,
      otherCapstone,
      affordable,
      canTake: !maxed && gateMet && missingReqs.length === 0 && !otherCapstone && affordable,
    };
  },

  /** The whole tree, annotated for the client. */
  getState(worldPlayer) {
    const budget = this.budget(worldPlayer);
    const chosen = worldPlayer?.kingNodes || [];

    const nodes = Object.values(NODES).map(node => ({
      ...node,
      ...this.nodeState(worldPlayer, node),
    }));

    const branches = Object.values(BRANCHES).map(b => ({
      ...b,
      spent: this.spentInBranch(chosen, b.key),
    }));

    return {
      kingLevel: worldPlayer?.kingLevel || 1,
      kingXP: worldPlayer?.kingXP || 0,
      ...budget,
      branches,
      nodes,
      tierGates: TIER_GATES,
      multipliers: this.multipliers(worldPlayer),
      chosen,
    };
  },

  /** Validate a single point of investment. */
  validateSpend(worldPlayer, nodeKey) {
    const node = NODES[nodeKey];
    if (!node) {
      return { ok: false, code: 400, reason: '👑 UNKNOWN: No such calling sits in the crown\'s tree.' };
    }

    const s = this.nodeState(worldPlayer, node);

    if (s.maxed) return { ok: false, code: 409, reason: `👑 MASTERED: "${node.name}" can be studied no further.` };
    if (!s.affordable) return { ok: false, code: 402, reason: '👑 UNEARNED: The crown has no points to spend.' };
    if (s.otherCapstone) return { ok: false, code: 403, reason: '👑 CROWNED: A king wears one crown. Renounce it first.' };
    if (s.missingReqs.length) {
      const nice = NODES[s.missingReqs[0]]?.name || s.missingReqs[0];
      return { ok: false, code: 403, reason: `👑 FOUNDATIONS: "${nice}" comes first.` };
    }
    if (!s.gateMet) {
      return {
        ok: false, code: 403,
        reason: `👑 UNPROVEN: Spend ${s.gateNeeded} points in ${BRANCHES[node.branch].name} to reach this depth (thou hast ${s.branchSpent}).`,
      };
    }

    return { ok: true, node };
  },
};

module.exports = KingService;
module.exports.emptyMultipliers = emptyMultipliers;
