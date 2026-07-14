const mongoose = require('mongoose');

const DragonSchema = new mongoose.Schema({
    villageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', required: true },
    ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'WorldPlayer', required: true },
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ['Emberwing', 'Frostwing', 'Stormwing'],
        required: true
    },
    status: {
        type: String,
        enum: ['Hatching', 'Idle', 'Training'],
        default: 'Hatching'
    },
    level:        { type: Number, default: 1 },
    experience:   { type: Number, default: 0 },
    health:       { type: Number, default: 0 },
    maxHealth:    { type: Number, default: 0 },
    attack:       { type: Number, default: 0 },
    defense:      { type: Number, default: 0 },
    breathDamage: { type: Number, default: 0 },
    hatchUntil:    { type: Date, default: null },
    trainingUntil: { type: Date, default: null },
}, { timestamps: true });

// Base stats per dragon type (at level 1)
DragonSchema.statics.BASE_STATS = {
    Emberwing: { health: 150, attack: 80, defense: 20, breathDamage: 100 },
    Frostwing: { health: 250, attack: 30, defense: 90, breathDamage:  40 },
    Stormwing: { health: 200, attack: 60, defense: 60, breathDamage:  70 },
};

module.exports = { DragonSchema };
