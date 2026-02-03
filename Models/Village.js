const mongoose = require('mongoose');

const VillageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Player', // Changed from User to Player
    required: true 
  },
  x: { type: Number, default: 500 },
  y: { type: Number, default: 500 },
  resources: {
    wood: { type: Number, default: 500 },
    clay: { type: Number, default: 500 },
    iron: { type: Number, default: 400 }
  },
  buildings: {
        headquarters: { type: Number, default: 1 },
        timberCamp: { type: Number, default: 1 },
        clayPit: { type: Number, default: 1 },
        ironMine: { type: Number, default: 1 },
        barracks: { type: Number, default: 0 },
        smithy: { type: Number, default: 0 },
        warehouse: { type: Number, default: 1 },
        academy: { type: Number, default: 0 }
    },
    research: {
        spearmanLevel: { type: Number, default: 1 },
        swordsmanLevel: { type: Number, default: 0 }, // 0 means not researched yet
        archerLevel: { type: Number, default: 0 }
    },
  upgradeQueue: [
        {
            building: String,
            finishTime: Number
        }
    ],
  army: {
        spearman: { type: Number, default: 0 },
        swordsman: { type: Number, default: 0 },
        archer: { type: Number, default: 0 },
        noble: { type: Number, default: 0 }
    },
    lastResourceUpdate: { type: Date, default: Date.now },
    loyalty: { type: Number, default: 100 },
    lastLoyaltyUpdate: { type: Date, default: Date.now },
    trainingQueue: [
        {
            unitType: String,
            amount: Number,
            finishTime: Number,
            startTime: Number
        }
    ]
});

module.exports = mongoose.models.Village || mongoose.model('Village', VillageSchema);