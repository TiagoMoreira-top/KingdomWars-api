const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    attackerId: String,
    defenderId: String,
    attackerName: String,
    defenderName: String,
    originName: String,
    targetName: String,
    winner: String,
    attackerUnits: Object, // { spearman: { initial: 100, lost: 20 }, ... }
    defenderUnits: Object,
    loot: { wood: Number, clay: Number, iron: Number },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);