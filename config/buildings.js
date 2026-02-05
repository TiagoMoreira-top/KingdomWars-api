const BUILDINGS = {
  // --- CORE INFRASTRUCTURE ---
  greatHall: {
    name: "Great Hall",
    baseCost: { wood: 90, clay: 80, stone: 70 },
    costMultiplier: 1.25,
    timeMultiplier: 1.2,
    growthFactor: 0.95,
    baseBuildTime: 120,
    basePop: 5,           // ⚔️ Workers at Level 1
    popMultiplier: 1.15,  // ⚔️ Labor demand scaling
    maxLevel: 30,
    pointValue: 10,
    pointFactor: 1.2,
    requirements: {}
  },
  warehouse: {
    name: "Warehouse",
    baseCost: { wood: 60, clay: 50, stone: 40 },
    costMultiplier: 1.4,
    timeMultiplier: 1.2,
    growthFactor: 1.25,
    baseBuildTime: 80,
    basePop: 2,
    popMultiplier: 1.1,
    storageBase: 1000,
    maxLevel: 30,
    pointValue: 4,
    pointFactor: 1.2,
    requirements: {}
  },
  farm: {
    name: "Farm",
    baseCost: { wood: 45, clay: 40, stone: 30 },
    costMultiplier: 1.4,
    timeMultiplier: 1.15,
    growthFactor: 1.13, // ⚔️ Capacity growth
    baseBuildTime: 60,
    populationBase: 50, // ⚔️ Capacity at Level 1
    maxLevel: 30,
    pointValue: 3,
    pointFactor: 1.2,
    requirements: {}
  },

  // --- RESOURCE PRODUCTION ---
  woodFarm: {
    name: "Wood Farm",
    baseCost: { wood: 50, clay: 40, stone: 30 },
    costMultiplier: 1.18,
    timeMultiplier: 1.15,
    growthFactor: 1.15,
    baseBuildTime: 60,
    basePop: 4,
    popMultiplier: 1.15,
    productionBase: 50,
    maxLevel: 30,
    pointValue: 2,
    pointFactor: 1.2,
    requirements: {}
  },
  clayFarm: {
    name: "Clay Farm",
    baseCost: { wood: 40, clay: 50, stone: 30 },
    costMultiplier: 1.18,
    timeMultiplier: 1.15,
    growthFactor: 1.15,
    baseBuildTime: 60,
    basePop: 4,
    popMultiplier: 1.15,
    productionBase: 50,
    maxLevel: 30,
    pointValue: 2,
    pointFactor: 1.2,
    requirements: {}
  },
  stoneFarm: {
    name: "Stone Farm",
    baseCost: { wood: 40, clay: 30, stone: 50 },
    costMultiplier: 1.18,
    timeMultiplier: 1.15,
    growthFactor: 1.15,
    baseBuildTime: 60,
    basePop: 4,
    popMultiplier: 1.15,
    productionBase: 50,
    maxLevel: 30,
    pointValue: 2,
    pointFactor: 1.2,
    requirements: {}
  },

  // --- MILITARY & DEFENSE ---
  barracks: {
    name: "Barracks",
    baseCost: { wood: 200, clay: 170, stone: 90 },
    costMultiplier: 1.7,
    timeMultiplier: 1.25,
    growthFactor: 0.02,
    baseBuildTime: 300,
    basePop: 7,
    popMultiplier: 1.2,
    maxLevel: 25,
    pointValue: 8,
    pointFactor: 1.2,
    requirements: { greatHall: 3 }
  },
  stable: {
    name: "Stable",
    baseCost: { wood: 600, clay: 500, stone: 400 },
    costMultiplier: 1.8,
    timeMultiplier: 1.3,
    growthFactor: 0.88,
    baseBuildTime: 600,
    basePop: 12,
    popMultiplier: 1.25,
    maxLevel: 20,
    pointValue: 12,
    pointFactor: 1.2,
    requirements: { greatHall: 10, barracks: 5 }
  },
  wall: {
    name: "Wall",
    baseCost: { wood: 50, clay: 100, stone: 200 },
    costMultiplier: 2.1,
    timeMultiplier: 1.3,
    growthFactor: 1.05,
    baseBuildTime: 400,
    basePop: 0, // ⚔️ Walls require no permanent housing
    popMultiplier: 1,
    defenseBonusBase: 0.05,
    maxLevel: 20,
    pointValue: 5,
    pointFactor: 1.2,
    requirements: { greatHall: 3 }
  },

  // --- UTILITY ---
  market: {
    name: "Market",
    baseCost: { wood: 100, clay: 100, stone: 100 },
    costMultiplier: 1.5,
    timeMultiplier: 1.2,
    growthFactor: 1,
    baseBuildTime: 240,
    basePop: 5,
    popMultiplier: 1.15,
    merchantsBase: 1,
    maxLevel: 25,
    pointValue: 6,
    pointFactor: 1.2,
    requirements: { greatHall: 5 }
  }
};

module.exports = BUILDINGS;