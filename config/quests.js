/**
 * 📜 THE STEWARD'S CHARGES
 *
 * A guided chain for a new lord. Each charge names one concrete thing to do,
 * pays for doing it, and by paying accelerates the next one — so the opening
 * hours have direction instead of a blank village and twenty-one buildings.
 *
 * OBJECTIVE CONTRACT — every charge declares one `objective`, read by
 * QuestService. Adding a charge is config only, provided its type is known:
 *
 *   building_level   target: buildingKey, count: level   — raise it this high
 *   any_building     count: n                            — n structures at lvl 1+
 *   troops           target: unitKey|'any', count: n      — hold n of them
 *   resources        target: 'wood'|…|'any', count: n     — hold n at once
 *   research         target: researchKey                  — settle that study
 *   research_any     count: n                             — settle n studies
 *   points           count: n                             — village worth
 *   king_level       count: n                             — the crown's level
 *   stat             target: statKey, count: n            — a WorldPlayer stat
 *   gladiators       count: n                             — champions kept
 *
 * Rewards are paid once, on claim, and are capped by warehouse space like any
 * other income — a full warehouse cannot be overfilled by a charge.
 */

const QUESTS = {
  /* ══════════ CHAPTER I — FIRST SMOKE ══════════ */
  first_timber: {
    key: 'first_timber', chapter: 1, order: 1,
    name: 'First Timber',
    description: 'A holding is built of wood before it is built of anything else. Raise the woodcutter to level 3.',
    hint: 'Open the Great Hall and upgrade the Wood Farm.',
    objective: { type: 'building_level', target: 'woodFarm', count: 3 },
    reward: { wood: 200, clay: 150, stone: 100, gold: 0 },
    requires: [],
  },
  clay_and_stone: {
    key: 'clay_and_stone', chapter: 1, order: 2,
    name: 'Clay and Stone',
    description: 'Timber alone raises nothing that lasts. Bring the clay pit and the quarry to level 3.',
    hint: 'Both the Clay Farm and the Stone Farm must reach level 3.',
    objective: { type: 'multi', all: [
      { type: 'building_level', target: 'clayFarm', count: 3 },
      { type: 'building_level', target: 'stoneFarm', count: 3 },
    ] },
    reward: { wood: 300, clay: 300, stone: 300, gold: 0 },
    requires: ['first_timber'],
  },
  somewhere_to_put_it: {
    key: 'somewhere_to_put_it', chapter: 1, order: 3,
    name: 'Somewhere To Put It',
    description: 'Goods left in the open are goods left for someone else. Raise the warehouse to level 4.',
    hint: 'A fuller warehouse also raises the ceiling on every resource you hold.',
    objective: { type: 'building_level', target: 'warehouse', count: 4 },
    reward: { wood: 400, clay: 400, stone: 400, gold: 0 },
    requires: ['clay_and_stone'],
  },
  mouths_to_feed: {
    key: 'mouths_to_feed', chapter: 1, order: 4,
    name: 'Mouths To Feed',
    description: 'Every building and every soldier eats. Raise the farm to level 5.',
    hint: 'Population gates everything. When you cannot build, this is usually why.',
    objective: { type: 'building_level', target: 'farm', count: 5 },
    reward: { wood: 500, clay: 500, stone: 400, gold: 25 },
    requires: ['somewhere_to_put_it'],
  },

  /* ══════════ CHAPTER II — A SEAT WORTH HOLDING ══════════ */
  seat_of_power: {
    key: 'seat_of_power', chapter: 2, order: 1,
    name: 'A Seat Of Power',
    description: 'The Great Hall governs what else may be raised, and how fast the masons work. Bring it to level 5.',
    hint: 'Every level of the Great Hall shortens every other construction.',
    objective: { type: 'building_level', target: 'greatHall', count: 5 },
    reward: { wood: 700, clay: 700, stone: 700, gold: 50 },
    requires: ['mouths_to_feed'],
  },
  a_village_takes_shape: {
    key: 'a_village_takes_shape', chapter: 2, order: 2,
    name: 'A Village Takes Shape',
    description: 'Raise eight different structures, of any level, within thy walls.',
    hint: 'Breadth matters as much as depth. Unlock what you can.',
    objective: { type: 'any_building', count: 8 },
    reward: { wood: 800, clay: 800, stone: 800, gold: 75 },
    requires: ['seat_of_power'],
  },
  the_first_stones: {
    key: 'the_first_stones', chapter: 2, order: 3,
    name: 'The First Stones',
    description: 'A holding without a wall is a larder. Raise the wall to level 3.',
    hint: 'Each level of wall multiplies the strength of everyone standing behind it.',
    objective: { type: 'building_level', target: 'wall', count: 3 },
    reward: { wood: 600, clay: 700, stone: 1000, gold: 50 },
    requires: ['a_village_takes_shape'],
  },
  a_thousand_of_each: {
    key: 'a_thousand_of_each', chapter: 2, order: 4,
    name: 'Full Coffers',
    description: 'Hold two thousand of wood, clay and stone at one time.',
    hint: 'If your stores keep capping out, the warehouse is the answer.',
    objective: { type: 'multi', all: [
      { type: 'resources', target: 'wood', count: 2000 },
      { type: 'resources', target: 'clay', count: 2000 },
      { type: 'resources', target: 'stone', count: 2000 },
    ] },
    reward: { wood: 0, clay: 0, stone: 0, gold: 250 },
    requires: ['the_first_stones'],
  },

  /* ══════════ CHAPTER III — MEN AT ARMS ══════════ */
  raise_the_levy: {
    key: 'raise_the_levy', chapter: 3, order: 1,
    name: 'Raise The Levy',
    description: 'Build a barracks. Peasants do not become soldiers by wishing.',
    hint: 'The Barracks needs a Great Hall of level 3.',
    objective: { type: 'building_level', target: 'barracks', count: 1 },
    reward: { wood: 600, clay: 500, stone: 400, gold: 50 },
    requires: ['seat_of_power'],
  },
  twenty_spears: {
    key: 'twenty_spears', chapter: 3, order: 2,
    name: 'Twenty Spears',
    description: 'Muster twenty soldiers of any kind into thy garrison.',
    hint: 'Troops in the barracks queue do not count until they march out of it.',
    objective: { type: 'troops', target: 'any', count: 20 },
    reward: { wood: 500, clay: 500, stone: 500, gold: 100 },
    requires: ['raise_the_levy'],
  },
  a_standing_army: {
    key: 'a_standing_army', chapter: 3, order: 3,
    name: 'A Standing Army',
    description: 'Hold one hundred soldiers at once. A number that makes a neighbour reconsider.',
    hint: 'Watch your population. An army you cannot feed is an army you cannot raise.',
    objective: { type: 'troops', target: 'any', count: 100 },
    reward: { wood: 1200, clay: 1200, stone: 1200, gold: 200 },
    requires: ['twenty_spears'],
  },
  first_blood: {
    key: 'first_blood', chapter: 3, order: 4,
    name: 'First Blood',
    description: 'Win a battle. The chronicles begin somewhere.',
    hint: 'Send troops from the Reunion Point. Scout before you strike.',
    objective: { type: 'stat', target: 'battlesWon', count: 1 },
    reward: { wood: 1000, clay: 1000, stone: 1000, gold: 300 },
    requires: ['a_standing_army'],
  },

  /* ══════════ CHAPTER IV — THE STACKS ══════════ */
  raise_the_library: {
    key: 'raise_the_library', chapter: 4, order: 1,
    name: 'Raise The Library',
    description: 'Knowledge outlasts walls. Build a library.',
    hint: 'The Library needs a Great Hall of 10 and a Market of 5.',
    objective: { type: 'building_level', target: 'library', count: 1 },
    reward: { wood: 900, clay: 900, stone: 900, gold: 150 },
    requires: ['a_village_takes_shape'],
  },
  first_study: {
    key: 'first_study', chapter: 4, order: 2,
    name: 'The First Study',
    description: 'Settle any one question in thy Library. Scholarship is permanent.',
    hint: 'Crop Rotation is the cheapest opening and pays out forever.',
    objective: { type: 'research_any', count: 1 },
    reward: { wood: 800, clay: 800, stone: 800, gold: 200 },
    requires: ['raise_the_library'],
  },
  a_learned_court: {
    key: 'a_learned_court', chapter: 4, order: 3,
    name: 'A Learned Court',
    description: 'Settle four questions. Thy people\'s patents lie further up this road.',
    hint: 'Military patents are the only way to field your race\'s own troops.',
    objective: { type: 'research_any', count: 4 },
    reward: { wood: 1500, clay: 1500, stone: 1500, gold: 400 },
    requires: ['first_study'],
  },

  /* ══════════ CHAPTER V — BEYOND THE PALISADE ══════════ */
  strike_the_vein: {
    key: 'strike_the_vein', chapter: 5, order: 1,
    name: 'Strike The Vein',
    description: 'Sink a gold mine. Coin buys what timber cannot.',
    hint: 'The mine also holds your gold — it has no vault of its own.',
    objective: { type: 'building_level', target: 'goldMine', count: 1 },
    reward: { wood: 1000, clay: 1000, stone: 1200, gold: 300 },
    requires: ['a_thousand_of_each'],
  },
  a_name_worth_knowing: {
    key: 'a_name_worth_knowing', chapter: 5, order: 2,
    name: 'A Name Worth Knowing',
    description: 'Bring thy holding to five hundred points of worth.',
    hint: 'Points come from every structure you raise. Breadth pays here.',
    objective: { type: 'points', count: 500 },
    reward: { wood: 2000, clay: 2000, stone: 2000, gold: 500 },
    requires: ['strike_the_vein'],
  },
  the_crown_grows: {
    key: 'the_crown_grows', chapter: 5, order: 3,
    name: 'The Crown Grows',
    description: 'Reach the fifth level of kingship.',
    hint: 'The crown gains experience from construction, battle and the arena.',
    objective: { type: 'king_level', count: 5 },
    reward: { wood: 2500, clay: 2500, stone: 2500, gold: 750 },
    requires: ['a_name_worth_knowing'],
  },
};

/** Ordered for display: chapter, then order within the chapter. */
function questList() {
  return Object.values(QUESTS).sort((a, b) => a.chapter - b.chapter || a.order - b.order);
}

/** Chapter numbers present, in order. */
function chapters() {
  return [...new Set(questList().map(q => q.chapter))];
}

module.exports = { QUESTS, questList, chapters };
