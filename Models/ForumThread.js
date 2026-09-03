const mongoose = require('mongoose');

/**
 * 📜 A THREAD IN THE ALLIANCE HALL
 *
 * Scoped to one alliance. There is no public forum — everything here is
 * readable only by members of `allianceId`, which every query filters on.
 *
 * The last-post fields are denormalised so the thread LIST needs one query
 * instead of one per thread. They are written by the controller whenever a
 * reply lands or a post is removed.
 */
const ForumThreadSchema = new mongoose.Schema({
  allianceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  title:      { type: String, required: true, trim: true, maxlength: 120 },

  authorId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  authorName: { type: String, required: true },

  /** Pinned threads sort above everything else. Generals and the Leader only. */
  pinned: { type: Boolean, default: false },
  /** A locked thread can still be read, but takes no new replies. */
  locked: { type: Boolean, default: false },

  postCount:      { type: Number, default: 1 },
  lastPostAt:     { type: Date, default: Date.now },
  lastPostAuthor: { type: String, default: null },

  createdAt: { type: Date, default: Date.now },
});

// The listing order: pinned first, then most recently active.
ForumThreadSchema.index({ allianceId: 1, pinned: -1, lastPostAt: -1 });

module.exports = ForumThreadSchema;
