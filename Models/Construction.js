const mongoose = require('mongoose');

const constructionSchema = new mongoose.Schema({
    villageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', required: true },
    buildingName: { type: String, required: true },
    levelTarget: { type: Number, required: true },
    finishedAt: { type: Date, required: true }
});

module.exports = mongoose.model('Construction', constructionSchema);