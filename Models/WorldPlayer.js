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

  // 🩸 The oath sworn on entering this realm. Permanent — a lord may not
  // change people once their first village stands.
  race: { type: String, default: 'ashvale', index: true },

  // 🪓 The sentinel that nominally holds every barbarian village. Excluded
  // from rankings and the census — it is scenery, not a rival.
  isBarbarian: { type: Boolean, default: false, index: true },

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

  // 👑 The crown's chosen callings, one entry per rank held. A flat list
  // keeps spending an append and refunding a filter — no rank table to
  // drift out of step.
  kingNodes: [{ type: String }],

  // 🎒 The lord's baggage. `inventory` is what is owned but not in use,
  // `equipped` the relics currently worn, `activeBoosts` the consumables
  // still running. Boosts are filtered by expiry on read, never trusted.
  inventory: [{
    itemKey: { type: String, required: true },
    qty:     { type: Number, default: 1, min: 0 },
  }],
  equipped: [{ type: String }],
  activeBoosts: [{
    itemKey:   { type: String, required: true },
    expiresAt: { type: Number, required: true },
  }],

  // 📜 The steward's ledger — which charges have been paid out.
  // Progress itself is never stored; it is derived from live state.
  quests: {
    claimed: [{ type: String }]
  },

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