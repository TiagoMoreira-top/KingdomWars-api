const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema({
    originId: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', required: true },
    destinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', required: true },
    ownerId: { type: String, required: true }, // Who sent them
    type: { type: String, enum: ['attack', 'support', 'return'], default: 'attack' },
    units: {
        spearman: { type: Number, default: 0 },
        swordsman: { type: Number, default: 0 },
        archer: { type: Number, default: 0 }
    },
    arrivalTime: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false }
});

module.exports = mongoose.model('Movement', movementSchema);