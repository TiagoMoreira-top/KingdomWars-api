const { QUESTS, questList } = require('../config/quests');

/**
 * 📜 THE STEWARD
 *
 * Progress is never stored — it is derived from village and crown state every
 * time it is asked for. That means a charge can never drift out of step with
 * reality, no background job is needed, and adding a new charge retroactively
 * credits players who already met it.
 *
 * The only thing persisted is which charges have been *claimed*, because a
 * reward must be paid exactly once.
 */

/** Count every soldier in a garrison, ignoring the wounded ward. */
function garrisonSize(army, unitKey = 'any') {
  if (!army) return 0;
  const plain = army.toObject ? army.toObject() : army;
  if (unitKey !== 'any') return plain[unitKey] || 0;
  let total = 0;
  for (const [key, value] of Object.entries(plain)) {
    if (key === 'wounded' || key === '_id' || key === '__v') continue;
    if (typeof value === 'number') total += value;
  }
  return total;
}

/**
 * Measure one objective. Returns { have, need } so the UI can draw a bar
 * rather than just a tick.
 */
function measure(objective, ctx) {
  const { village, worldPlayer } = ctx;
  const buildings = village.buildings || {};
  const need = objective.count ?? 1;

  switch (objective.type) {
    case 'building_level':
      return { have: buildings[objective.target] || 0, need };

    case 'any_building':
      return {
        have: Object.entries(buildings).filter(([k, v]) => typeof v === 'number' && v > 0).length,
        need,
      };

    case 'troops':
      return { have: garrisonSize(village.army, objective.target || 'any'), need };

    case 'resources': {
      const res = village.resources || {};
      if (objective.target === 'any') {
        return { have: Math.floor((res.wood || 0) + (res.clay || 0) + (res.stone || 0)), need };
      }
      return { have: Math.floor(res[objective.target] || 0), need };
    }

    case 'research':
      return { have: (village.completedResearches || []).includes(objective.target) ? 1 : 0, need: 1 };

    case 'research_any':
      return { have: (village.completedResearches || []).length, need };

    case 'points':
      return { have: village.points || 0, need };

    case 'king_level':
      return { have: worldPlayer?.kingLevel || 1, need };

    case 'stat':
      return { have: (worldPlayer?.stats && worldPlayer.stats[objective.target]) || 0, need };

    case 'gladiators':
      return { have: (village.gladiators || []).filter(g => !g || g.status !== 'Dead').length, need };

    case 'multi': {
      // Every sub-objective must be met. Progress is the worst of them, so the
      // bar reflects the part still outstanding.
      const parts = (objective.all || []).map(o => measure(o, ctx));
      const done = parts.filter(p => p.have >= p.need).length;
      return { have: done, need: parts.length, parts };
    }

    default:
      return { have: 0, need: 1 };
  }
}

const QuestService = {
  /**
   * The full chain, annotated with live progress and whether the reward is
   * still owed. `claimed` comes from the crown's record.
   */
  getState(village, worldPlayer) {
    const claimed = new Set((worldPlayer?.quests?.claimed) || []);
    const ctx = { village, worldPlayer };

    const quests = questList().map(q => {
      const unlocked = (q.requires || []).every(r => claimed.has(r));
      const progress = measure(q.objective, ctx);
      const complete = progress.have >= progress.need;

      return {
        key: q.key,
        chapter: q.chapter,
        order: q.order,
        name: q.name,
        description: q.description,
        hint: q.hint,
        objective: q.objective,
        reward: q.reward,
        requires: q.requires,
        progress,
        // A charge is only actionable once its predecessors are settled
        state: claimed.has(q.key) ? 'claimed'
          : !unlocked ? 'locked'
          : complete ? 'ready'
          : 'active',
      };
    });

    return {
      quests,
      claimedCount: claimed.size,
      total: quests.length,
      // What the UI should point the lord at right now
      current: quests.find(q => q.state === 'ready') || quests.find(q => q.state === 'active') || null,
    };
  },

  /**
   * Validate a claim without committing. The caller does the writing so the
   * reward and the record can go down in one transaction-ish step.
   */
  validateClaim(village, worldPlayer, questKey) {
    const quest = QUESTS[questKey];
    if (!quest) {
      return { ok: false, code: 400, reason: '📜 UNKNOWN: No such charge sits on the steward\'s desk.' };
    }

    const claimed = new Set((worldPlayer?.quests?.claimed) || []);
    if (claimed.has(questKey)) {
      return { ok: false, code: 409, reason: '📜 PAID: This charge was settled already.' };
    }

    const missing = (quest.requires || []).filter(r => !claimed.has(r));
    if (missing.length) {
      const nice = QUESTS[missing[0]]?.name || missing[0];
      return { ok: false, code: 403, reason: `📜 OUT OF ORDER: "${nice}" comes first.` };
    }

    const progress = measure(quest.objective, { village, worldPlayer });
    if (progress.have < progress.need) {
      return {
        ok: false, code: 403,
        reason: `📜 UNFINISHED: ${progress.have} of ${progress.need}. The steward is not satisfied.`,
      };
    }

    return { ok: true, quest, reward: quest.reward || {} };
  },
};

module.exports = QuestService;
module.exports.measure = measure;
module.exports.garrisonSize = garrisonSize;
