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
  allianceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alliance', default: null },
  allianceRole: { type: String, default: null }, // e.g., 'Leader', 'General', 'Member'

  // 📊 Local Achievements
  villagesCount: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now }
});

// Indexing for the Great Leaderboard
WorldPlayerSchema.index({ points: -1 });

module.exports = WorldPlayerSchema;