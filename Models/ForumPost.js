const mongoose = require('mongoose');

/**
 * 🖋️ ONE POST IN A THREAD
 *
 * The opening post of a thread is an ordinary post document like any other, so
 * editing and deletion work the same everywhere rather than needing a special
 * case for the first one.
 *
 * `allianceId` is carried here as well as on the thread. It is redundant, and
 * deliberately so: it means a post can never be read without proving alliance
 * membership, even if a query reaches a post directly by id.
 */
const ForumPostSchema = new mongoose.Schema({
  threadId:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  allianceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  authorId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  authorName: { type: String, required: true },

  body: { type: String, required: true, trim: true, maxlength: 4000 },

  /** Set when a post is edited, so the change is visible rather than silent. */
  editedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
});

ForumPostSchema.index({ threadId: 1, createdAt: 1 });

module.exports = ForumPostSchema;
