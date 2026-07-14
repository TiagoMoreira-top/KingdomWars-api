const mongoose = require('mongoose');

const WorldPlayerSchema = new mongoose.Schema({
  // 🔗 Connection to the Master User ID
  masterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    unique: true,
    index: true 
  },

  // 🎭 Local Identity
  username: { type: String, required: true },
  avatar: { type: String, default: 'default_lord.png' },

  // ⚔️ Global Worth in this Realm
  points: { type: Number, default: 0 },
  rank: { type: Number, default: 0 },
  
  // 🛡️ Alliance Ties
  allianceId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Alliance', default: null },
  allianceRole: { type: String, default: null },
  allianceName: { type: String, default: null },

  // 📊 Local Achievements
  villagesCount: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now },

  // 👑 The King
  kingXP:    { type: Number, default: 0 },
  kingLevel: { type: Number, default: 1 },

  // 📜 Battle Chronicle
  stats: {
    battlesWon:           { type: Number, default: 0 },
    battlesLost:          { type: Number, default: 0 },
    troopsKilled:         { type: Number, default: 0 },
    troopsLost:           { type: Number, default: 0 },
    resourcesPlundered:   { type: Number, default: 0 },
    buildingsConstructed: { type: Number, default: 0 },
    missionsLaunched:     { type: Number, default: 0 },
    gladiatorWins:        { type: Number, default: 0 },
    gladiatorLosses:      { type: Number, default: 0 },
    dragonsHatched:       { type: Number, default: 0 },
  }
});

// Indexing for the Great Leaderboard
WorldPlayerSchema.index({ points: -1 });

module.exports = WorldPlayerSchema;