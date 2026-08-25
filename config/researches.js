/**
 * 📜 THE LIBRARY'S WORK
 *
 * Scholarship is permanent, village-wide and one-way: a study once completed
 * is never lost and never repeated. Studies are gated on the Library's level
 * and on earlier studies, so each people climbs its own ladder.
 *
 * EFFECT CONTRACT — every study declares exactly one `effect`, and the engine
 * reads it by `type`. Adding a new study is config only, so long as its type
 * is one the engine already understands:
 *
 *   unlock_unit        value: unitKey     — permits recruitment of that troop
 *   unit_attack        value: 0.05        — +5% attack, all troops
 *   unit_defence       value: 0.05        — +5% defence, all troops
 *   production         value: 0.05        — +5% wood/clay/stone
 *   gold_production    value: 0.08        — +8% gold
 *   storage            value: 0.1         — +10% warehouse capacity
 *   gold_storage       value: 0.15        — +15% treasury capacity
 *   build_speed        value: 0.05        — works finish 5% sooner
 *   build_cost         value: 0.04        — works cost 4% less
 *   extra_building_slot value: 1          — one more mason crew
 *   recruit_speed      value: 0.06        — training 6% faster
 *   loot_capacity      value: 0.1         — +10% plunder carried
 *   troop_speed        value: 0.05        — +5% march speed
 *
 * `race` restricts a study to one people. Absent means everyone may take it.
 */

const RESEARCHES = {
  /* ═══════════ ECONOMY ═══════════ */
  crop_rotation: {
    key: 'crop_rotation', name: 'Crop Rotation', category: 'economy', tier: 1,
    description: 'Leave a third of the fields fallow each year and the other two give back more than all three did.',
    cost: { wood: 400, clay: 300, stone: 200, gold: 0 },
    researchTime: 900,
    requirements: { library: 1, researches: [] },
    effect: { type: 'production', value: 0.06 },
  },
  deep_cellars: {
    key: 'deep_cellars', name: 'Deep Cellars', category: 'economy', tier: 1,
    description: 'Dig beneath the granary. Cool, dry, and out of reach of a torch thrown over the wall.',
    cost: { wood: 350, clay: 500, stone: 400, gold: 0 },
    researchTime: 1200,
    requirements: { library: 2, researches: [] },
    effect: { type: 'storage', value: 0.12 },
  },
  guild_charters: {
    key: 'guild_charters', name: 'Guild Charters', category: 'economy', tier: 2,
    description: 'Grant the trades their own courts and they will find efficiencies the crown never could.',
    cost: { wood: 900, clay: 800, stone: 700, gold: 100 },
    researchTime: 2400,
    requirements: { library: 5, researches: ['crop_rotation'] },
    effect: { type: 'build_cost', value: 0.06 },
  },
  assayers_mark: {
    key: 'assayers_mark', name: "Assayer's Mark", category: 'economy', tier: 2,
    description: 'Every ingot stamped and weighed. Theft becomes difficult enough that most stop trying.',
    cost: { wood: 600, clay: 700, stone: 900, gold: 250 },
    researchTime: 2700,
    requirements: { library: 6, researches: ['deep_cellars'] },
    effect: { type: 'gold_production', value: 0.15 },
  },
  vaulted_treasury: {
    key: 'vaulted_treasury', name: 'Vaulted Treasury', category: 'economy', tier: 3,
    description: 'A stone throat, a locked grate, and one key. The mine may now outpace the counting-house.',
    cost: { wood: 1200, clay: 1400, stone: 1800, gold: 600 },
    researchTime: 5400,
    requirements: { library: 10, researches: ['assayers_mark'] },
    effect: { type: 'gold_storage', value: 0.35 },
  },
  three_shifts: {
    key: 'three_shifts', name: 'Three Shifts', category: 'economy', tier: 3,
    description: 'The quarry never sleeps. Neither, increasingly, do the quarrymen.',
    cost: { wood: 1600, clay: 1500, stone: 1500, gold: 400 },
    researchTime: 6000,
    requirements: { library: 12, researches: ['guild_charters'] },
    effect: { type: 'production', value: 0.12 },
  },

  /* ═══════════ LOGISTICS ═══════════ */
  masons_guild: {
    key: 'masons_guild', name: "Masons' Guild", category: 'logistics', tier: 1,
    description: 'Organised crews, shared scaffolding, and a foreman who can read. Works go up markedly faster.',
    cost: { wood: 500, clay: 450, stone: 600, gold: 0 },
    researchTime: 1500,
    requirements: { library: 3, researches: [] },
    effect: { type: 'build_speed', value: 0.08 },
  },
  second_crew: {
    key: 'second_crew', name: 'The Second Crew', category: 'logistics', tier: 2,
    description: 'Enough trained masons to run two sites at once without either falling idle.',
    cost: { wood: 1400, clay: 1200, stone: 1600, gold: 300 },
    researchTime: 4200,
    requirements: { library: 8, researches: ['masons_guild'] },
    effect: { type: 'extra_building_slot', value: 1 },
  },
  third_crew: {
    key: 'third_crew', name: 'The Third Crew', category: 'logistics', tier: 3,
    description: 'A standing corps of builders. The scaffolding never comes down at all now.',
    cost: { wood: 3200, clay: 3000, stone: 3600, gold: 1200 },
    researchTime: 10800,
    requirements: { library: 15, researches: ['second_crew'] },
    effect: { type: 'extra_building_slot', value: 1 },
  },
  drover_roads: {
    key: 'drover_roads', name: 'Drover Roads', category: 'logistics', tier: 2,
    description: 'Gravel the cart tracks and a column arrives a day early and still able to fight.',
    cost: { wood: 800, clay: 900, stone: 1100, gold: 150 },
    researchTime: 3000,
    requirements: { library: 7, researches: ['masons_guild'] },
    effect: { type: 'troop_speed', value: 0.08 },
  },
  reinforced_packs: {
    key: 'reinforced_packs', name: 'Reinforced Packs', category: 'logistics', tier: 2,
    description: 'Better frames, better straps. A raider comes home with half again what he could carry before.',
    cost: { wood: 700, clay: 600, stone: 400, gold: 200 },
    researchTime: 2700,
    requirements: { library: 6, researches: [] },
    effect: { type: 'loot_capacity', value: 0.15 },
  },

  /* ═══════════ MILITARY — doctrine ═══════════ */
  drill_yards: {
    key: 'drill_yards', name: 'Drill Yards', category: 'military', tier: 1,
    description: 'Two hours a day on the sand. Tedious, unpopular, and the difference between a rout and a line.',
    cost: { wood: 450, clay: 400, stone: 350, gold: 50 },
    researchTime: 1500,
    requirements: { library: 2, researches: [] },
    effect: { type: 'unit_attack', value: 0.06 },
  },
  shield_wall: {
    key: 'shield_wall', name: 'Shield Wall', category: 'military', tier: 1,
    description: 'Overlap, brace, and do not look at what is coming. Older than any kingdom and still unbeaten.',
    cost: { wood: 400, clay: 450, stone: 500, gold: 50 },
    researchTime: 1500,
    requirements: { library: 2, researches: [] },
    effect: { type: 'unit_defence', value: 0.06 },
  },
  levy_reform: {
    key: 'levy_reform', name: 'Levy Reform', category: 'military', tier: 2,
    description: 'Standing muster rolls and pre-cut kit. Recruits reach the line in half the time.',
    cost: { wood: 900, clay: 850, stone: 700, gold: 200 },
    researchTime: 3300,
    requirements: { library: 6, researches: ['drill_yards'] },
    effect: { type: 'recruit_speed', value: 0.12 },
  },
  tempered_steel: {
    key: 'tempered_steel', name: 'Tempered Steel', category: 'military', tier: 3,
    description: 'Quenched, drawn, and quenched again. Edges that survive a second battle.',
    cost: { wood: 1800, clay: 1600, stone: 2000, gold: 700 },
    researchTime: 7200,
    requirements: { library: 12, researches: ['drill_yards', 'shield_wall'] },
    effect: { type: 'unit_attack', value: 0.12 },
  },
  banded_mail: {
    key: 'banded_mail', name: 'Banded Mail', category: 'military', tier: 3,
    description: 'Riveted bands over padded linen. Heavier, hotter, and a great deal harder to kill.',
    cost: { wood: 1600, clay: 1800, stone: 2200, gold: 700 },
    researchTime: 7200,
    requirements: { library: 12, researches: ['shield_wall'] },
    effect: { type: 'unit_defence', value: 0.12 },
  },

  /* ═══════════ MILITARY — troop patents (race-locked) ═══════════ */
  patent_halberdier: {
    key: 'patent_halberdier', name: 'Patent: Halberdier', category: 'military', tier: 2, race: 'ashvale',
    description: 'The crown licenses the pole-arm drill to its barracks-masters.',
    cost: { wood: 800, clay: 700, stone: 600, gold: 150 },
    researchTime: 2700,
    requirements: { library: 4, researches: ['drill_yards'] },
    effect: { type: 'unlock_unit', value: 'halberdier' },
  },
  patent_crown_lancer: {
    key: 'patent_crown_lancer', name: 'Patent: Crown Lancer', category: 'military', tier: 3, race: 'ashvale',
    description: 'Only the throne may raise the throne\'s own horse.',
    cost: { wood: 1600, clay: 1400, stone: 1000, gold: 600 },
    researchTime: 6000,
    requirements: { library: 10, researches: ['patent_halberdier'] },
    effect: { type: 'unlock_unit', value: 'crown_lancer' },
  },
  patent_trebuchet: {
    key: 'patent_trebuchet', name: 'Patent: Trebuchet Crew', category: 'military', tier: 3, race: 'ashvale',
    description: 'The counterweight tables, sealed and released to the royal engineers.',
    cost: { wood: 2200, clay: 1600, stone: 2000, gold: 800 },
    researchTime: 8100,
    requirements: { library: 12, researches: ['patent_halberdier'] },
    effect: { type: 'unlock_unit', value: 'trebuchet_crew' },
  },

  patent_shieldbearer: {
    key: 'patent_shieldbearer', name: 'Patent: Shieldbearer', category: 'military', tier: 2, race: 'ironhold',
    description: 'The clans agree, after four years of argument, on a single shield pattern.',
    cost: { wood: 700, clay: 800, stone: 900, gold: 150 },
    researchTime: 2700,
    requirements: { library: 4, researches: ['shield_wall'] },
    effect: { type: 'unlock_unit', value: 'shieldbearer' },
  },
  patent_oathsworn: {
    key: 'patent_oathsworn', name: 'Patent: Oathsworn', category: 'military', tier: 3, race: 'ironhold',
    description: 'The oath is written down. Breaking it becomes a matter of record.',
    cost: { wood: 1400, clay: 1500, stone: 2200, gold: 600 },
    researchTime: 6600,
    requirements: { library: 10, researches: ['patent_shieldbearer'] },
    effect: { type: 'unlock_unit', value: 'oathsworn' },
  },
  patent_stonethrower: {
    key: 'patent_stonethrower', name: 'Patent: Stonethrower', category: 'military', tier: 3, race: 'ironhold',
    description: 'The quarry engine, re-rated for men instead of granite.',
    cost: { wood: 1800, clay: 1400, stone: 2800, gold: 700 },
    researchTime: 8100,
    requirements: { library: 12, researches: ['patent_shieldbearer'] },
    effect: { type: 'unlock_unit', value: 'stonethrower' },
  },

  patent_thornguard: {
    key: 'patent_thornguard', name: 'Patent: Thornguard', category: 'military', tier: 2, race: 'sylvan',
    description: 'The Covenant consents to teach the treeline drill outside the inner groves.',
    cost: { wood: 900, clay: 500, stone: 400, gold: 150 },
    researchTime: 2400,
    requirements: { library: 3, researches: ['drill_yards'] },
    effect: { type: 'unlock_unit', value: 'thornguard' },
  },
  patent_glade_ranger: {
    key: 'patent_glade_ranger', name: 'Patent: Glade Ranger', category: 'military', tier: 3, race: 'sylvan',
    description: 'Four hundred paces, in wind, at dusk. The examination has never been passed on a first attempt.',
    cost: { wood: 2000, clay: 900, stone: 700, gold: 600 },
    researchTime: 6600,
    requirements: { library: 10, researches: ['patent_thornguard'] },
    effect: { type: 'unlock_unit', value: 'glade_ranger' },
  },
  patent_stag_rider: {
    key: 'patent_stag_rider', name: 'Patent: Stag Rider', category: 'military', tier: 3, race: 'sylvan',
    description: 'The great elk agree to be ridden. Nobody involved describes it as taming.',
    cost: { wood: 2400, clay: 1000, stone: 600, gold: 700 },
    researchTime: 7200,
    requirements: { library: 11, researches: ['patent_thornguard'] },
    effect: { type: 'unlock_unit', value: 'stag_rider' },
  },

  patent_berserker: {
    key: 'patent_berserker', name: 'Patent: Berserker', category: 'military', tier: 2, race: 'emberhorde',
    description: 'The horde formalises what it was already doing, largely for the record-keeping.',
    cost: { wood: 800, clay: 600, stone: 300, gold: 150 },
    researchTime: 2400,
    requirements: { library: 3, researches: ['drill_yards'] },
    effect: { type: 'unlock_unit', value: 'berserker' },
  },
  patent_wolf_rider: {
    key: 'patent_wolf_rider', name: 'Patent: Wolf Rider', category: 'military', tier: 3, race: 'emberhorde',
    description: 'The wolves are not broken so much as negotiated with. Terms are renewed nightly.',
    cost: { wood: 1500, clay: 1200, stone: 600, gold: 600 },
    researchTime: 6000,
    requirements: { library: 9, researches: ['patent_berserker'] },
    effect: { type: 'unlock_unit', value: 'wolf_rider' },
  },
  patent_firethrower: {
    key: 'patent_firethrower', name: 'Patent: Firethrower', category: 'military', tier: 3, race: 'emberhorde',
    description: 'Pitch, naphtha and a fuse cut deliberately short. The crews are not consulted.',
    cost: { wood: 2000, clay: 1900, stone: 900, gold: 800 },
    researchTime: 7500,
    requirements: { library: 11, researches: ['patent_berserker'] },
    effect: { type: 'unlock_unit', value: 'firethrower' },
  },
};

/** Studies this people is permitted to undertake. */
function researchesForRace(raceKey) {
  const out = {};
  for (const [key, r] of Object.entries(RESEARCHES)) {
    if (!r.race || r.race === raceKey) out[key] = r;
  }
  return out;
}

/**
 * Sum every completed study of a given effect type.
 * Unlock effects are excluded — they are membership tests, not sums.
 */
function sumEffect(completed = [], type) {
  let total = 0;
  for (const key of completed) {
    const r = RESEARCHES[key];
    if (r && r.effect && r.effect.type === type && typeof r.effect.value === 'number') {
      total += r.effect.value;
    }
  }
  return total;
}

/** Every troop unlocked by the completed studies. */
function unlockedUnits(completed = []) {
  const out = new Set();
  for (const key of completed) {
    const r = RESEARCHES[key];
    if (r && r.effect && r.effect.type === 'unlock_unit') out.add(r.effect.value);
  }
  return out;
}

/** Every troop that exists only behind a patent — locked until studied. */
const PATENTED_UNITS = new Set(
  Object.values(RESEARCHES)
    .filter(r => r.effect && r.effect.type === 'unlock_unit')
    .map(r => r.effect.value)
);

module.exports = { RESEARCHES, researchesForRace, sumEffect, unlockedUnits, PATENTED_UNITS };
