const mongoose = require('mongoose');

const GladiatorSchema = new mongoose.Schema({
    villageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Village' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorldPlayer' },
    name: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['Murmillo', 'Thraex', 'Retiarius'], 
        default: 'Murmillo' 
    },
    status: { 
        type: String, 
        enum: ['Idle', 'Training', 'In_Arena', 'Dead'], 
        default: 'Idle' 
    },
    
    // --- ⏳ TIMING STATS ---
    // This stores the exact date/time when the current action ends
    trainingUntil: { type: Date, default: null },

    // --- BATTLE STATS ---
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    battlePoints: { type: Number, default: 10 },
    health: { type: Number, default: 100 },
    maxHealth: { type: Number, default: 100 },

    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = 
{
    GladiatorSchema: GladiatorSchema
};