const mongoose = require('mongoose');

const WorldSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  description: { type: String },
  status:      { type: String, enum: ['online', 'offline', 'maintenance', 'ended'], default: 'online' },
  playerCount: { type: Number, default: 0 },
  maxPlayers:  { type: Number, default: 1000 },
  players:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  worldUrl:    { type: String, required: true },
  dbName:      { type: String, required: true },
  createdAt:   { type: Date, default: Date.now },

  // Victory
  victoryThreshold: { type: Number, default: 10000 },
  winner: {
    playerId:  { type: mongoose.Schema.Types.ObjectId, default: null },
    username:  { type: String, default: null },
    points:    { type: Number, default: null },
  },
  endedAt: { type: Date, default: null },
  hallOfFame: [{
    rank:      Number,
    playerId:  mongoose.Schema.Types.ObjectId,
    username:  String,
    points:    Number,
    kingLevel: Number,
    stats: {
      battlesWon:   Number,
      troopsKilled: Number,
      dragonsHatched: Number,
    }
  }],
});

module.exports = mongoose.model('World', WorldSchema);
