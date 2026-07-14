const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  senderName: { type: String, required: true },

  // Direct message: recipientId set. Alliance broadcast: allianceId set, recipientId null.
  recipientId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  recipientName: { type: String, default: null },
  allianceId:    { type: mongoose.Schema.Types.ObjectId, default: null },

  subject: { type: String, required: true, maxlength: 80 },
  body:    { type: String, required: true, maxlength: 2000 },

  readBy:   [{ type: mongoose.Schema.Types.ObjectId }], // player IDs who have read it
  deletedBy:[{ type: mongoose.Schema.Types.ObjectId }], // soft-delete per player

  sentAt: { type: Date, default: Date.now },
});

MessageSchema.index({ recipientId: 1, sentAt: -1 });
MessageSchema.index({ senderId: 1, sentAt: -1 });
MessageSchema.index({ allianceId: 1, sentAt: -1 });

module.exports = MessageSchema;
