const UNITS = {
  common_slaves: {
      name: "Common Slave",
      description: "Unfortunate souls captured in raids or purchased from traders. They possess no will to fight until forged in the Arena.",
      baseCost: { wood: 0, clay: 0, stone: 0, gold: 1000 },
      trainTime: 300, // 5 minutes base time
      population: 1,
      attack: 0,
      defenseGeneral: 1,
      defenseCavalry: 1,
      speed: 25, // Slaves are slow and shackled
      lootCapacity: 0,
      requirements: { arena: 1 }
  },

  serf_levy: {
    name: "Serf Levy",
    description: "Peasants armed with tools. Weak, but their loss does not weigh on the crown's soul.",
    baseCost: { wood: 25, clay: 20, stone: 0 },
    trainTime: 30,
    population: 1,
    attack: 8,
    defenseGeneral: 10,
    defenseCavalry: 10,
    speed: 18,
    lootCapacity: 15,
    requirements: { barracks: 1 }
  },
  spearman: {
    name: "Spearman",
    description: "Disciplined infantry with long reach. The nightmare of any charging horse.",
    baseCost: { wood: 50, clay: 30, stone: 10 },
    trainTime: 60,
    population: 1,
    attack: 15,
    defenseGeneral: 15,
    defenseCavalry: 45,
    speed: 18,
    lootCapacity: 25,
    requirements: { barracks: 1 }
  },
  man_at_arms: {
    name: "Man-at-Arms",
    description: "Professional soldiers in partial plate. Reliable and sturdy in a shield wall.",
    baseCost: { wood: 40, clay: 70, stone: 100 },
    trainTime: 150,
    population: 2,
    attack: 35,
    defenseGeneral: 55,
    defenseCavalry: 20,
    speed: 20,
    lootCapacity: 20,
    requirements: { barracks: 5 }
  },
  swordsman: {
    name: "Swordsman",
    description: "Heavy assault troops specialized in breaching walls and clearing gates.",
    baseCost: { wood: 30, clay: 40, stone: 80 },
    trainTime: 120,
    population: 1,
    attack: 45,
    defenseGeneral: 30,
    defenseCavalry: 10,
    speed: 18,
    lootCapacity: 15,
    requirements: { barracks: 3 }
  },
  archer: {
    name: "Crossbow Archer",
    description: "Slow-firing but deadly. Their bolts can pierce the thickest of hauberks.",
    baseCost: { wood: 80, clay: 80, stone: 40 },
    trainTime: 140,
    population: 1,
    attack: 25,
    defenseGeneral: 25,
    defenseCavalry: 15,
    speed: 18,
    lootCapacity: 10,
    requirements: { barracks: 5 }
  },
  longbowman: {
    name: "Longbowman",
    description: "Highly trained archers capable of thinning enemy ranks before the clash.",
    baseCost: { wood: 140, clay: 30, stone: 0 },
    trainTime: 180,
    population: 1,
    attack: 30,
    defenseGeneral: 10,
    defenseCavalry: 5,
    speed: 16,
    lootCapacity: 10,
    requirements: { barracks: 7, woodFarm: 10 }
  },

  palfrey_messenger: {
    name: "Palfrey Messenger",
    description: "Swift riders who carry reports. They are eyes in the dark, not blades in the light.",
    baseCost: { wood: 50, clay: 50, stone: 20 },
    trainTime: 90,
    population: 2,
    attack: 0,
    defenseGeneral: 5,
    defenseCavalry: 2,
    speed: 6,
    lootCapacity: 0,
    requirements: { stable: 1 }
  },
  light_knight: {
    name: "Light Knight",
    description: "Mounted raiders meant for swift strikes and pillaging the countryside.",
    baseCost: { wood: 150, clay: 120, stone: 200 },
    trainTime: 300,
    population: 4,
    attack: 90,
    defenseGeneral: 30,
    defenseCavalry: 30,
    speed: 9,
    lootCapacity: 80,
    requirements: { stable: 3 }
  },
  gilded_knight: {
    name: "Gilded Knight",
    description: "The ultimate noble warrior. Heavily armored, devastating on the charge.",
    baseCost: { wood: 300, clay: 400, stone: 700 },
    trainTime: 800,
    population: 6,
    attack: 160,
    defenseGeneral: 180,
    defenseCavalry: 100,
    speed: 11,
    lootCapacity: 50,
    requirements: { stable: 10, greatHall: 12 }
  },

  ram: {
    name: "Battering Ram",
    description: "An iron-capped oak trunk designed to splinter enemy gates and crumble walls.",
    baseCost: { wood: 300, clay: 200, stone: 200 },
    trainTime: 1200,
    population: 5,
    attack: 2,
    defenseGeneral: 20,
    defenseCavalry: 50,
    speed: 30,
    lootCapacity: 0,
    requirements: { workshop: 1 }
  },
  catapult: {
    name: "War Catapult",
    description: "A siege engine that hurls massive stones. Capable of reducing buildings to rubble.",
    baseCost: { wood: 320, clay: 400, stone: 100 },
    trainTime: 1800,
    population: 8,
    attack: 100,
    defenseGeneral: 100,
    defenseCavalry: 50,
    speed: 30,
    lootCapacity: 0,
    requirements: { workshop: 10 }
  },

  noble: {
    name: "Noble Lord",
    description: "A claimant to the throne. His presence can convince other villages to join thy cause.",
    baseCost: { wood: 20000, clay: 25000, stone: 20000 },
    trainTime: 10800,
    population: 100,
    attack: 50,
    defenseGeneral: 100,
    defenseCavalry: 100,
    speed: 35,
    lootCapacity: 0,
    requirements: { academy: 1 }
  }
};

module.exports = UNITS;