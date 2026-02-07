const BUILDINGS = {
  greatHall: {
    name: "Great Hall",
    description: "The heart of your domain. Upgrading this majestic hall increases the speed of all other construction projects within the village.",
    baseCost: { wood: 90, clay: 80, stone: 70 },
    costMultiplier: 1.25,
    timeMultiplier: 1.2,
    growthFactor: 0.03,
    baseBuildTime: 120,
    basePop: 5,
    popMultiplier: 1.15,
    maxLevel: 30,
    pointValue: 10,
    pointFactor: 1.26,
    requirements: {}
  },

  woodFarm: {
    name: "Wood Farm",
    description: "Deep within the ancient groves, hardy woodsmen fell timber to fuel your kingdom's expansion and provide essential building materials.",
    baseCost: { wood: 50, clay: 40, stone: 30 },
    costMultiplier: 1.18,
    timeMultiplier: 1.15,
    growthFactor: 1.16,
    baseBuildTime: 60,
    basePop: 4,
    popMultiplier: 1.15,
    productionBase: 80,
    maxLevel: 30,
    pointValue: 8,
    pointFactor: 1.21,
    requirements: {}
  },

  clayFarm: {
    name: "Clay Farm",
    description: "Laborers toil in the riverbanks to harvest rich clay, vital for crafting the sturdy bricks and pottery required by your growing populace.",
    baseCost: { wood: 40, clay: 50, stone: 30 },
    costMultiplier: 1.18,
    timeMultiplier: 1.15,
    growthFactor: 1.16,
    baseBuildTime: 60,
    basePop: 4,
    popMultiplier: 1.15,
    productionBase: 80,
    maxLevel: 30,
    pointValue: 8,
    pointFactor: 1.21,
    requirements: {}
  },

  stoneFarm: {
    name: "Stone Farm",
    description: "Masons extract massive blocks of granite from the earth's crust to reinforce your structures and raise impenetrable defenses.",
    baseCost: { wood: 40, clay: 30, stone: 25 },
    costMultiplier: 1.18,
    timeMultiplier: 1.15,
    growthFactor: 1.16,
    baseBuildTime: 60,
    basePop: 4,
    popMultiplier: 1.15,
    productionBase: 80,
    maxLevel: 30,
    pointValue: 8,
    pointFactor: 1.21,
    requirements: {}
  },

  barracks: {
    name: "Barracks",
    description: "The primary training ground for your infantry. Here, peasants are forged into disciplined soldiers ready to die for your honor.",
    baseCost: { wood: 200, clay: 170, stone: 90 },
    costMultiplier: 1.7,
    timeMultiplier: 1.25,
    growthFactor: 0.02,
    baseBuildTime: 100,
    basePop: 7,
    popMultiplier: 1.2,
    maxLevel: 25,
    pointValue: 8,
    pointFactor: 1.26,
    requirements: { greatHall: 3 }
  },

  stable: {
    name: "Stable",
    description: "A sanctuary for warhorses and riders. Upgrading the stables allows for the swift training of devastating cavalry units.",
    baseCost: { wood: 300, clay: 350, stone: 150 },
    costMultiplier: 1.8,
    timeMultiplier: 1.3,
    growthFactor: 0.88,
    baseBuildTime: 600,
    basePop: 12,
    popMultiplier: 1.25,
    maxLevel: 20,
    pointValue: 12,
    pointFactor: 1.26,
    requirements: { greatHall: 10, barracks: 5 }
  },

  market: {
    name: "Market",
    description: "A bustling hub of trade where merchants barter goods. Leveling the market provides more merchants to facilitate resource exchange with allies.",
    baseCost: { wood: 80, clay: 90, stone: 70 },
    costMultiplier: 1.5,
    timeMultiplier: 1.2,
    growthFactor: 1,
    baseBuildTime: 240,
    basePop: 5,
    popMultiplier: 1.15,
    merchantsBase: 1,
    maxLevel: 25,
    pointValue: 6,
    pointFactor: 1.1,
    requirements: { greatHall: 5 }
  },

  warehouse: {
    name: "Warehouse",
    description: "A vast storage complex to protect your resources from the elements and raiding parties. Higher levels increase total resource capacity.",
    baseCost: { wood: 60, clay: 50, stone: 40 },
    costMultiplier: 1.26,
    timeMultiplier: 1.2,
    growthFactor: 1.25,
    baseBuildTime: 80,
    basePop: 2,
    popMultiplier: 1.1,
    storageBase: 1000,
    maxLevel: 30,
    pointValue: 4,
    pointFactor: 1.1,
    requirements: {}
  },

  farm: {
    name: "Farm",
    description: "Providing the grain and livestock necessary to sustain your village. The larger the farm, the greater the population your village can support.",
    baseCost: { wood: 45, clay: 40, stone: 30 },
    costMultiplier: 1.3,
    timeMultiplier: 1.15,
    growthFactor: 1.23,
    baseBuildTime: 60,
    populationBase: 60,
    maxLevel: 30,
    pointValue: 3,
    pointFactor: 1.1,
    requirements: {}
  },

  wall: {
    name: "Wall",
    description: "A ring of stone and timber that shields your people. The wall significantly boosts the defensive capabilities of your stationed troops.",
    baseCost: { wood: 50, clay: 100, stone: 200 },
    costMultiplier: 2.1,
    timeMultiplier: 1.3,
    growthFactor: 1.05,
    baseBuildTime: 400,
    basePop: 0,
    popMultiplier: 1,
    defenseBonusBase: 0.05,
    maxLevel: 20,
    pointValue: 5,
    pointFactor: 1.1,
    requirements: { greatHall: 3 }
  },
};

module.exports = BUILDINGS;