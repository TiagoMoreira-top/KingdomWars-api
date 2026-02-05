const mongoose = require('mongoose');

const WorldSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  status: { type: String, enum: ['online', 'offline', 'maintenance'], default: 'online' },
  playerCount: { type: Number, default: 0 },
  maxPlayers: { type: Number, default: 1000 },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  worldUrl: { type: String, required: true },
  dbName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('World', WorldSchema);