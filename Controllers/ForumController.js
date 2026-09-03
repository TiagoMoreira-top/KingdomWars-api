/**
 * 🏛️ THE ALLIANCE HALL
 *
 * Threads and posts, readable only by the alliance that owns them.
 *
 * THE RULE THAT MATTERS: every single handler starts by resolving the caller's
 * own allianceId from req.worldPlayer, and every query is filtered on it. A
 * thread or post id from the request body is never trusted on its own — if it
 * belongs to another alliance the lookup simply finds nothing. That is why the
 * allianceId is carried on posts as well as threads.
 *
 * Moderation (pin, lock, removing someone else's words) is for the Leader and
 * Generals. Everyone may write, and may remove or amend their own posts.
 */

const PAGE = 20;

/** The caller's alliance, or null. Every handler goes through this. */
function seat(req) {
  const me = req.worldPlayer;
  if (!me?.allianceId) return null;
  return {
    me,
    allianceId: me.allianceId,
    canModerate: ['Leader', 'General'].includes(me.allianceRole),
  };
}

const NO_SEAT = { status: 403, error: '🏛️ UNSWORN: Thou belongest to no alliance.' };

exports.listThreads = async (req, res) => {
  try {
    const s = seat(req);
    if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });

    const Thread = req.getForumThreadModel();
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const [threads, total] = await Promise.all([
      Thread.find({ allianceId: s.allianceId })
        .sort({ pinned: -1, lastPostAt: -1 })
        .skip((page - 1) * PAGE)
        .limit(PAGE)
        .lean(),
      Thread.countDocuments({ allianceId: s.allianceId }),
    ]);

    res.json({
      success: true,
      threads,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE)),
      canModerate: s.canModerate,
      meId: s.me._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createThread = async (req, res) => {
  try {
    const s = seat(req);
    if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });

    const { title, body } = req.body;
    if (!title?.trim() || !body?.trim())
      return res.status(400).json({ error: 'A thread needs a title and something to say.' });

    const Thread = req.getForumThreadModel();
    const Post = req.getForumPostModel();

    const thread = await Thread.create({
      allianceId: s.allianceId,
      title: title.trim().slice(0, 120),
      authorId: s.me._id,
      authorName: s.me.username,
      postCount: 1,
      lastPostAt: new Date(),
      lastPostAuthor: s.me.username,
    });

    // The opening post is an ordinary post, so it edits and deletes like any other.
    await Post.create({
      threadId: thread._id,
      allianceId: s.allianceId,
      authorId: s.me._id,
      authorName: s.me.username,
      body: body.trim().slice(0, 4000),
    });

    res.status(201).json({ success: true, thread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getThread = async (req, res) => {
  try {
    const s = seat(req);
    if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });

    const Thread = req.getForumThreadModel();
    const Post = req.getForumPostModel();

    // Filtered on allianceId, so another alliance's thread is simply not found.
    const thread = await Thread.findOne({
      _id: req.params.threadId,
      allianceId: s.allianceId,
    }).lean();
    if (!thread) return res.status(404).json({ error: '📜 LOST: No such thread in this hall.' });

    const posts = await Post.find({ threadId: thread._id, allianceId: s.allianceId })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, thread, posts, canModerate: s.canModerate, meId: s.me._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.reply = async (req, res) => {
  try {
    const s = seat(req);
    if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });

    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'An empty reply says nothing.' });

    const Thread = req.getForumThreadModel();
    const Post = req.getForumPostModel();

    const thread = await Thread.findOne({ _id: req.params.threadId, allianceId: s.allianceId });
    if (!thread) return res.status(404).json({ error: '📜 LOST: No such thread in this hall.' });
    if (thread.locked) return res.status(403).json({ error: '🔒 SEALED: This thread takes no more replies.' });

    const post = await Post.create({
      threadId: thread._id,
      allianceId: s.allianceId,
      authorId: s.me._id,
      authorName: s.me.username,
      body: body.trim().slice(0, 4000),
    });

    thread.postCount = (thread.postCount || 0) + 1;
    thread.lastPostAt = new Date();
    thread.lastPostAuthor = s.me.username;
    await thread.save();

    res.status(201).json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Pin and lock are moderation, so Leader and Generals only. */
async function setFlag(req, res, field, onWord, offWord) {
  const s = seat(req);
  if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });
  if (!s.canModerate)
    return res.status(403).json({ error: '🏛️ UNRANKED: Only the Leader and Generals may do that.' });

  const Thread = req.getForumThreadModel();
  const thread = await Thread.findOne({ _id: req.params.threadId, allianceId: s.allianceId });
  if (!thread) return res.status(404).json({ error: '📜 LOST: No such thread in this hall.' });

  thread[field] = !thread[field];
  await thread.save();

  res.json({ success: true, [field]: thread[field], message: thread[field] ? onWord : offWord });
}

exports.togglePin = (req, res) =>
  setFlag(req, res, 'pinned', '📌 RAISED: Pinned to the top of the hall.', 'Unpinned.')
    .catch(err => res.status(500).json({ error: err.message }));

exports.toggleLock = (req, res) =>
  setFlag(req, res, 'locked', '🔒 SEALED: The thread takes no more replies.', 'Unsealed.')
    .catch(err => res.status(500).json({ error: err.message }));

exports.deleteThread = async (req, res) => {
  try {
    const s = seat(req);
    if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });

    const Thread = req.getForumThreadModel();
    const Post = req.getForumPostModel();

    const thread = await Thread.findOne({ _id: req.params.threadId, allianceId: s.allianceId });
    if (!thread) return res.status(404).json({ error: '📜 LOST: No such thread in this hall.' });

    const isAuthor = thread.authorId.toString() === s.me._id.toString();
    if (!isAuthor && !s.canModerate)
      return res.status(403).json({ error: '🏛️ NOT THINE: Only the author or a General may remove it.' });

    // Posts go with the thread — no orphans left behind.
    await Post.deleteMany({ threadId: thread._id, allianceId: s.allianceId });
    await Thread.deleteOne({ _id: thread._id });

    res.json({ success: true, message: '🗑️ STRUCK: The thread is gone from the record.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const s = seat(req);
    if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });

    const Thread = req.getForumThreadModel();
    const Post = req.getForumPostModel();

    const post = await Post.findOne({ _id: req.params.postId, allianceId: s.allianceId });
    if (!post) return res.status(404).json({ error: '📜 LOST: No such post.' });

    const isAuthor = post.authorId.toString() === s.me._id.toString();
    if (!isAuthor && !s.canModerate)
      return res.status(403).json({ error: '🏛️ NOT THINE: Only the author or a General may remove it.' });

    const remaining = await Post.countDocuments({ threadId: post.threadId });

    // Removing the last post would leave an empty thread — take the thread too.
    if (remaining <= 1) {
      await Post.deleteOne({ _id: post._id });
      await Thread.deleteOne({ _id: post.threadId, allianceId: s.allianceId });
      return res.json({ success: true, threadRemoved: true, message: '🗑️ STRUCK: The last post, and the thread with it.' });
    }

    await Post.deleteOne({ _id: post._id });

    // Keep the denormalised counters honest.
    const last = await Post.findOne({ threadId: post.threadId }).sort({ createdAt: -1 }).lean();
    await Thread.updateOne(
      { _id: post.threadId, allianceId: s.allianceId },
      {
        $set: {
          postCount: remaining - 1,
          lastPostAt: last ? last.createdAt : new Date(),
          lastPostAuthor: last ? last.authorName : null,
        },
      }
    );

    res.json({ success: true, message: '🗑️ STRUCK: The post is removed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.editPost = async (req, res) => {
  try {
    const s = seat(req);
    if (!s) return res.status(NO_SEAT.status).json({ error: NO_SEAT.error });

    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'An empty post says nothing.' });

    const Post = req.getForumPostModel();
    const post = await Post.findOne({ _id: req.params.postId, allianceId: s.allianceId });
    if (!post) return res.status(404).json({ error: '📜 LOST: No such post.' });

    // Moderators may remove words, but they may not put words in another's mouth.
    if (post.authorId.toString() !== s.me._id.toString())
      return res.status(403).json({ error: '🏛️ NOT THINE: A post may only be amended by the one who wrote it.' });

    post.body = body.trim().slice(0, 4000);
    post.editedAt = new Date();
    await post.save();

    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
