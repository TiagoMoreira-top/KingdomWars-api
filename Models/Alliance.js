const mongoose = require('mongoose');

const AllianceSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true, maxlength: 40 },
  tag:         { type: String, required: true, unique: true, trim: true, maxlength: 6, uppercase: true },
  description: { type: String, default: '', maxlength: 300 },

  leaderId: { type: mongoose.Schema.Types.ObjectId, required: true },

  members: [{
    playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role:     { type: String, enum: ['Leader', 'General', 'Member'], default: 'Member' },
    joinedAt: { type: Date, default: Date.now }
  }],

  pendingInvites: [{ type: mongoose.Schema.Types.ObjectId }], // WorldPlayer IDs

  points: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

AllianceSchema.index({ points: -1 });

module.exports = AllianceSchema;
