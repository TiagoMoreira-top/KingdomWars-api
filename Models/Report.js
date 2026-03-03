const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'MISSION_COMBAT', 
      'MISSION_SCOUT', 
      'MISSION_SUPPORT',
      'ACHIEVEMENT', 
      'FRIEND_REQUEST', 
      'ALLIANCE_INVITE', 
      'SYSTEM_INFO',
    ]
  },
  status: {
    type: String,
    enum: ['UNREAD', 'READ', 'ARCHIVED'],
    default: 'UNREAD'
  },
  title: {
    type: String,
    required: true
  },
  
  // This field contains the specific data for each type.
  // Using 'Mixed' allows us to store different objects (loot, player names, etc.)
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Optional: references to other entities involved
  originUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  originVillage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village'
  },

  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 7*24*60*60*1000) // Auto-delete after 7 days
  }
}, { 
  timestamps: true 
});

// Index for performance when cleaning up old reports
ReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = {
  ReportSchema: ReportSchema
};