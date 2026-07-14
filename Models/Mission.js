const mongoose = require('mongoose');

const MissionSchema = new mongoose.Schema({
  originVillage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village',
    required: true
  },
  originCoords: {
    x: { type: Number, required: false },
    y: { type: Number, required: false }
  },
  targetVillage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village'
  },
  targetCoords: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  lord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorldPlayer',
    required: true
  },
  type: {
    type: String,
    enum: ['attack', 'support', 'return', 'scout'],
    required: true
  },
  units: {
    type: Map,
    of: Number,
    required: true
  },
  resources: {
    wood: { type: Number, default: 0 },
    clay: { type: Number, default: 0 },
    stone: { type: Number, default: 0 },
    iron: { type: Number, default: 0 }
  },
  departureTime: {
    type: Date,
    default: Date.now
  },
  arrivalTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['marching', 'completed', 'cancelled'],
    default: 'marching'
  }
}, { timestamps: true });

module.exports = {
  MissionSchema: MissionSchema
};