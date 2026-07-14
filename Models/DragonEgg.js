const mongoose = require('mongoose');

const DragonEggSchema = new mongoose.Schema({
  villageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', default: null },
  foundBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Village', default: null },
  seeded:    { type: Boolean, default: true },
  takenAt:   { type: Date, default: null }
});

module.exports = { DragonEggSchema };
