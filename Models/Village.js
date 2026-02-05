const mongoose = require('mongoose');

const VillageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Player',
    required: true 
  },
  worldId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'World', 
    required: true 
  },
  x: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 1000 
  },
  y: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 1000 
  },

  points: { type: Number, default: 0 },

  // --- THE TREASURY ---
  resources: {
    wood:  { type: Number, default: 500 },
    clay:  { type: Number, default: 500 },
    stone: { type: Number, default: 500 },
    maxStorage: { type: Number, default: 1000 }
  },
  lastResourceUpdate: { type: Date, default: Date.now },

  // --- THE INFRASTRUCTURE ---
  buildings: {
    greatHall:   { type: Number, default: 1 },
    warehouse:   { type: Number, default: 1 },
    farm:        { type: Number, default: 1 },
    barracks:    { type: Number, default: 0 },
    stable:      { type: Number, default: 0 },
    market:      { type: Number, default: 0 },
    woodFarm:    { type: Number, default: 1 },
    clayFarm:    { type: Number, default: 1 },
    stoneFarm:   { type: Number, default: 1 },
    wall:        { type: Number, default: 0 }
  },

  // --- THE POPULACE ---
  population: {
    habitants: { type: Number, default: 50 },
    used:      { type: Number, default: 0 }
  },

  // --- THE ARMORY ---
  research: {
    spearmanLevel:  { type: Number, default: 1 },
    swordsmanLevel: { type: Number, default: 0 },
    archerLevel:    { type: Number, default: 0 },
    scoutLevel:     { type: Number, default: 0 },
    knightLevel:    { type: Number, default: 0 }
  },

  // --- THE GARRISON ---
  army: {
    // --- The Rank and File ---
    serf_levy:        { type: Number, default: 0 },
    man_at_arms:      { type: Number, default: 0 },
    longbowman:       { type: Number, default: 0 },
    spearman:  { type: Number, default: 0 },
    swordsman: { type: Number, default: 0 },
    archer:    { type: Number, default: 0 },
    
    // --- The Mounted & Elite ---
    palfrey_messenger: { type: Number, default: 0 },
    gilded_knight:     { type: Number, default: 0 },
    light_knight:     { type: Number, default: 0 },

    noble:     { type: Number, default: 0 }
  },

  // --- THE QUEUES ---
  upgradeQueue: [
    {
      building:    { type: String },
      targetLevel: { type: Number },
      finishTime:  { type: Number } 
    }
  ],
  trainingQueue: [
    {
      unitKey:   { type: String },
      amount:     { type: Number },
      startTime:  { type: Number },
      finishTime: { type: Number }
    }
  ],

  // --- SETTLEMENT STATUS ---
  loyalty: { type: Number, default: 100 },
  lastLoyaltyUpdate: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure the soil is unique to one Lord
VillageSchema.index({ worldId: 1, x: 1, y: 1 }, { unique: true });

module.exports = {
  VillageSchema: VillageSchema // ⚔️ This is the "Blueprint"
};