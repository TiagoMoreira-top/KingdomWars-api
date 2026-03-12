const mongoose = require('mongoose');

const MarketOfferSchema = new mongoose.Schema({
    worldId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'World', 
        required: true,
        index: true 
    },
    originVillageId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Village', 
        required: true 
    },
    ownerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'WorldPlayer', 
        required: true 
    },
    
    // Trade Details
    offeredRes: { 
        type: String, 
        enum: ['wood', 'clay', 'stone', 'gold'], 
        required: true 
    },
    offeredAmount: { type: Number, required: true },
    
    wantedRes: { 
        type: String, 
        enum: ['wood', 'clay', 'stone', 'gold'], 
        required: true 
    },
    wantedAmount: { type: Number, required: true },

    // For "Great Market" filtering (e.g., 1:1, 1:2 ratios)
    ratio: { type: Number }, 
    
    // Travel time calculation helpers
    originX: { type: Number },
    originY: { type: Number }
}, { timestamps: true });

// Index for fast browsing of the "Great Market"
MarketOfferSchema.index({ worldId: 1, offeredRes: 1, wantedRes: 1 });

module.exports = {
  MarketOfferSchema: MarketOfferSchema
};