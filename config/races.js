/**
 * 🩸 THE FOUR PEOPLES
 *
 * A lord swears to one people when they enter a realm, and that oath is
 * permanent. Each people brings three troops no other can muster, one
 * structure no other can raise, a set of standing traits, and a short list
 * of common troops they refuse (or are unable) to field.
 *
 * Design intent — every people is strong somewhere and soft somewhere else:
 *
 *   Ashvale    balanced      cheap works, rich mint        no signature weakness
 *   Ironhold   defensive     stone and walls              slow marches
 *   Sylvan     mobile        wood and speed               brittle walls
 *   Emberhorde offensive     plunder and cheap attackers  poor defence
 *
 * ART NOTE: the signature structures reuse existing plates via `art`, since
 * the asset library has no bespoke images for them yet. Swap `art` for a new
 * key once real plates exist — nothing else needs to change.
 */

const RACES = {
  /* ═══════════════════════════════════════════════════════════
     ASHVALE CROWN — the old kingdom. Nothing exceptional, nothing weak.
     ═══════════════════════════════════════════════════════════ */
  ashvale: {
    key: 'ashvale',
    name: 'Ashvale Crown',
    epithet: 'The Old Kingdom',
    description:
      'Heirs of the last true throne. Their masons are the cheapest in the known world and their mints never sleep, ' +
      'but they hold no advantage on the field that another people cannot answer.',
    colour: '#d4af37',
    banner: '#8a6d3b',

    traits: {
      buildCostReduction: 0.08,   // works cost 8% less
      buildTimeReduction: 0.05,
      goldProduction: 0.25,       // +25% gold
      woodProduction: 0,
      clayProduction: 0,
      stoneProduction: 0,
      troopSpeed: 0,
      lootCapacity: 0,
      wallStrength: 0,
      offenceBonus: 0,
      defenceBonus: 0,
      recruitSpeed: 0,
    },

    blockedUnits: [],
    buildings: ['mint'],
    units: ['halberdier', 'crown_lancer', 'trebuchet_crew'],
  },

  /* ═══════════════════════════════════════════════════════════
     IRONHOLD CLANS — mountain folk. They dig, they hold, they endure.
     ═══════════════════════════════════════════════════════════ */
  ironhold: {
    key: 'ironhold',
    name: 'Ironhold Clans',
    epithet: 'The Deep Delvers',
    description:
      'Clans of the deep quarries. Their stone flows twice as fast and their walls have never been taken by storm — ' +
      'but their columns march at a crawl, and a war they cannot reach is a war they cannot win.',
    colour: '#9aa0a8',
    banner: '#5d564b',

    traits: {
      buildCostReduction: 0,
      buildTimeReduction: 0,
      goldProduction: 0,
      woodProduction: -0.1,
      clayProduction: 0,
      stoneProduction: 0.25,      // +25% stone
      troopSpeed: -0.15,          // slow marches
      lootCapacity: 0,
      wallStrength: 0.3,          // +30% wall
      offenceBonus: -0.05,
      defenceBonus: 0.15,
      recruitSpeed: 0,
    },

    // Light horse has no place in the deep holds
    blockedUnits: ['light_knight', 'palfrey_messenger'],
    buildings: ['deepForge'],
    units: ['shieldbearer', 'oathsworn', 'stonethrower'],
  },

  /* ═══════════════════════════════════════════════════════════
     SYLVAN COVENANT — forest folk. They strike first and are gone.
     ═══════════════════════════════════════════════════════════ */
  sylvan: {
    key: 'sylvan',
    name: 'Sylvan Covenant',
    epithet: 'The Green Oath',
    description:
      'Wardens of the old wood. Timber answers their call and their columns move faster than word of them travels — ' +
      'but they build in living wood, and living wood burns.',
    colour: '#6d8f4a',
    banner: '#33502a',

    traits: {
      buildCostReduction: 0,
      buildTimeReduction: 0.1,
      goldProduction: -0.1,
      woodProduction: 0.25,       // +25% wood
      clayProduction: 0,
      stoneProduction: -0.1,
      troopSpeed: 0.2,            // swift marches
      lootCapacity: 0.1,
      wallStrength: -0.2,         // brittle walls
      offenceBonus: 0,
      defenceBonus: 0,
      recruitSpeed: 0.1,
    },

    // Heavy siege cannot be dragged through the deep wood
    blockedUnits: ['ram'],
    buildings: ['mootGrove'],
    units: ['thornguard', 'glade_ranger', 'stag_rider'],
  },

  /* ═══════════════════════════════════════════════════════════
     EMBERHORDE — raiders. They take, they burn, they do not garrison.
     ═══════════════════════════════════════════════════════════ */
  emberhorde: {
    key: 'emberhorde',
    name: 'Emberhorde',
    epithet: 'The Ash Riders',
    description:
      'They keep no treasury but what they take. Their raiders carry a third again in plunder and their attackers ' +
      'cost a pittance — but ask them to hold a wall and they will show you their backs.',
    colour: '#c1502e',
    banner: '#6b2418',

    traits: {
      buildCostReduction: 0,
      buildTimeReduction: 0,
      goldProduction: 0,
      woodProduction: 0,
      clayProduction: 0.15,
      stoneProduction: 0,
      troopSpeed: 0.1,
      lootCapacity: 0.35,         // +35% plunder
      wallStrength: -0.15,
      offenceBonus: 0.15,
      defenceBonus: -0.2,         // poor garrison
      recruitSpeed: 0.15,
      offensiveUnitDiscount: 0.12,
    },

    // The horde has no nobility and no patience for gilded knights
    blockedUnits: ['gilded_knight'],
    buildings: ['warPit'],
    units: ['berserker', 'wolf_rider', 'firethrower'],
  },
};

/* ═══════════════════════════════════════════════════════════════
   RACE TROOPS — merged into the common roster at load time
   ═══════════════════════════════════════════════════════════════ */
const RACE_UNITS = {
  // ── Ashvale ──
  halberdier: {
    name: 'Halberdier', race: 'ashvale',
    description: 'Crown infantry with pole-arms. They break a charge and then walk through what is left of it.',
    baseCost: { wood: 60, clay: 50, stone: 40 },
    trainTime: 140, population: 2,
    attack: 30, defenseGeneral: 50, defenseCavalry: 70,
    speed: 18, lootCapacity: 20,
    requirements: { barracks: 5 },
  },
  crown_lancer: {
    name: 'Crown Lancer', race: 'ashvale',
    description: 'The throne\'s own horse. Costly, versatile, and a banner the levies will follow anywhere.',
    baseCost: { wood: 120, clay: 90, stone: 60, gold: 40 },
    trainTime: 320, population: 4,
    category: 'cavalry',
    attack: 90, defenseGeneral: 55, defenseCavalry: 45,
    speed: 32, lootCapacity: 70,
    requirements: { stable: 8 },
  },
  trebuchet_crew: {
    name: 'Trebuchet Crew', race: 'ashvale',
    description: 'Royal engineers. Slow to build, slower to move, and utterly final where they are aimed.',
    baseCost: { wood: 320, clay: 180, stone: 260 },
    trainTime: 900, population: 8,
    category: 'siege',
    attack: 130, defenseGeneral: 25, defenseCavalry: 15,
    speed: 8, lootCapacity: 0,
    requirements: { workshop: 8 },
  },

  // ── Ironhold ──
  shieldbearer: {
    name: 'Shieldbearer', race: 'ironhold',
    description: 'A wall that eats. Nothing in the field is harder to remove from a gate it has decided to keep.',
    baseCost: { wood: 50, clay: 60, stone: 110 },
    trainTime: 190, population: 2,
    attack: 12, defenseGeneral: 95, defenseCavalry: 70,
    speed: 14, lootCapacity: 10,
    requirements: { barracks: 4 },
  },
  oathsworn: {
    name: 'Oathsworn', race: 'ironhold',
    description: 'Clan veterans who have sworn not to step backward. Most of them keep the oath.',
    baseCost: { wood: 80, clay: 70, stone: 140 },
    trainTime: 260, population: 3,
    attack: 65, defenseGeneral: 75, defenseCavalry: 40,
    speed: 15, lootCapacity: 25,
    requirements: { barracks: 12, deepForge: 1 },
  },
  stonethrower: {
    name: 'Stonethrower', race: 'ironhold',
    description: 'A quarry engine turned on men. Ironhold has never seen the distinction as important.',
    baseCost: { wood: 200, clay: 140, stone: 380 },
    trainTime: 780, population: 7,
    category: 'siege',
    attack: 115, defenseGeneral: 40, defenseCavalry: 20,
    speed: 6, lootCapacity: 0,
    requirements: { workshop: 6 },
  },

  // ── Sylvan ──
  thornguard: {
    name: 'Thornguard', race: 'sylvan',
    description: 'Skirmishers who fight from the treeline and vanish before the answer arrives.',
    baseCost: { wood: 55, clay: 25, stone: 15 },
    trainTime: 80, population: 1,
    attack: 28, defenseGeneral: 22, defenseCavalry: 30,
    speed: 26, lootCapacity: 35,
    requirements: { barracks: 2 },
  },
  glade_ranger: {
    name: 'Glade Ranger', race: 'sylvan',
    description: 'They loose once, at four hundred paces, and it is enough more often than it has any right to be.',
    baseCost: { wood: 130, clay: 60, stone: 30 },
    trainTime: 260, population: 2,
    attack: 85, defenseGeneral: 30, defenseCavalry: 25,
    speed: 24, lootCapacity: 40,
    requirements: { barracks: 10, mootGrove: 1 },
  },
  stag_rider: {
    name: 'Stag Rider', race: 'sylvan',
    description: 'Mounted on the great elk of the deep wood. Nothing on four legs in this world is faster.',
    baseCost: { wood: 180, clay: 70, stone: 40 },
    trainTime: 300, population: 4,
    category: 'cavalry',
    attack: 70, defenseGeneral: 45, defenseCavalry: 35,
    speed: 44, lootCapacity: 90,
    requirements: { stable: 6 },
  },

  // ── Emberhorde ──
  berserker: {
    name: 'Berserker', race: 'emberhorde',
    description: 'They are given ale, a hand-axe and a direction. Two of the three are usually returned.',
    baseCost: { wood: 70, clay: 40, stone: 20 },
    trainTime: 110, population: 1,
    attack: 75, defenseGeneral: 12, defenseCavalry: 10,
    speed: 22, lootCapacity: 30,
    requirements: { barracks: 3 },
  },
  wolf_rider: {
    name: 'Wolf Rider', race: 'emberhorde',
    description: 'Raiders on dire-wolves. They are over the wall and into the granary before the bell finishes ringing.',
    baseCost: { wood: 110, clay: 80, stone: 30 },
    trainTime: 250, population: 3,
    category: 'cavalry',
    attack: 80, defenseGeneral: 25, defenseCavalry: 20,
    speed: 40, lootCapacity: 120,
    requirements: { stable: 4 },
  },
  firethrower: {
    name: 'Firethrower', race: 'emberhorde',
    description: 'A cart of pitch and a short fuse. The horde considers the crew part of the ammunition.',
    baseCost: { wood: 260, clay: 220, stone: 100 },
    trainTime: 640, population: 6,
    category: 'siege',
    attack: 125, defenseGeneral: 15, defenseCavalry: 10,
    speed: 12, lootCapacity: 0,
    requirements: { workshop: 5, warPit: 1 },
  },
};

/* ═══════════════════════════════════════════════════════════════
   SIGNATURE STRUCTURES — one per people
   ═══════════════════════════════════════════════════════════════ */
const RACE_BUILDINGS = {
  mint: {
    name: 'Royal Mint', race: 'ashvale', art: 'market',
    description: 'Where the crown strikes its own coin. Gold flows faster, and the treasury holds more of it.',
    baseCost: { wood: 350, clay: 500, stone: 400 },
    costMultiplier: 1.26, timeMultiplier: 1.3, growthFactor: 0.03,
    baseBuildTime: 900, basePop: 6, popMultiplier: 1.17,
    maxLevel: 20, pointValue: 14, pointFactor: 1.23,
    requirements: { greatHall: 8, goldMine: 5 },
    effect: { goldProductionPerLevel: 0.04, goldCapacityPerLevel: 0.06 },
  },
  deepForge: {
    name: 'Deep Forge', race: 'ironhold', art: 'workshop',
    description: 'A furnace sunk into the bedrock. Every shield leaving it is thicker than the last.',
    baseCost: { wood: 300, clay: 380, stone: 620 },
    costMultiplier: 1.28, timeMultiplier: 1.32, growthFactor: 0.03,
    baseBuildTime: 1100, basePop: 9, popMultiplier: 1.19,
    maxLevel: 20, pointValue: 16, pointFactor: 1.24,
    requirements: { greatHall: 8, workshop: 3 },
    effect: { defencePerLevel: 0.015, siegeSpeedPerLevel: 0.02 },
  },
  mootGrove: {
    name: 'Moot Grove', race: 'sylvan', art: 'church',
    description: 'A ring of standing trees where the Covenant takes counsel. Word travels from here faster than horses.',
    baseCost: { wood: 620, clay: 240, stone: 180 },
    costMultiplier: 1.24, timeMultiplier: 1.28, growthFactor: 0.035,
    baseBuildTime: 820, basePop: 5, popMultiplier: 1.16,
    maxLevel: 20, pointValue: 13, pointFactor: 1.22,
    requirements: { greatHall: 6, farm: 8 },
    effect: { troopSpeedPerLevel: 0.012, watchRangePerLevel: 0.05 },
  },
  warPit: {
    name: 'War Pit', race: 'emberhorde', art: 'arena',
    description: 'A sand pit ringed with spears. Those who climb out of it are ready; the rest were never needed.',
    baseCost: { wood: 420, clay: 460, stone: 260 },
    costMultiplier: 1.27, timeMultiplier: 1.29, growthFactor: 0.04,
    baseBuildTime: 860, basePop: 8, popMultiplier: 1.2,
    maxLevel: 20, pointValue: 15, pointFactor: 1.24,
    requirements: { greatHall: 6, barracks: 5 },
    effect: { offencePerLevel: 0.015, recruitSpeedPerLevel: 0.02 },
  },
};

const DEFAULT_RACE = 'ashvale';
const RACE_KEYS = Object.keys(RACES);

/** Every trait, with sane defaults, for a given race key. */
function getRaceTraits(raceKey) {
  const race = RACES[raceKey] || RACES[DEFAULT_RACE];
  return {
    buildCostReduction: 0, buildTimeReduction: 0,
    goldProduction: 0, woodProduction: 0, clayProduction: 0, stoneProduction: 0,
    troopSpeed: 0, lootCapacity: 0, wallStrength: 0,
    offenceBonus: 0, defenceBonus: 0, recruitSpeed: 0,
    offensiveUnitDiscount: 0,
    ...race.traits,
  };
}

/** May this people field this troop? */
function canRaceTrain(raceKey, unitKey) {
  const race = RACES[raceKey] || RACES[DEFAULT_RACE];
  if ((race.blockedUnits || []).includes(unitKey)) return false;
  // A race-specific troop belongs only to its own people
  const owner = (RACE_UNITS[unitKey] || {}).race;
  return !owner || owner === race.key;
}

/** May this people raise this structure? */
function canRaceBuild(raceKey, buildingKey) {
  const owner = (RACE_BUILDINGS[buildingKey] || {}).race;
  if (!owner) return true;
  return owner === (RACES[raceKey] ? raceKey : DEFAULT_RACE);
}

module.exports = {
  RACES, RACE_UNITS, RACE_BUILDINGS, RACE_KEYS, DEFAULT_RACE,
  getRaceTraits, canRaceTrain, canRaceBuild,
};
