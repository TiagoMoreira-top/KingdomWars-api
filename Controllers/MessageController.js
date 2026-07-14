// ⚔️ MessageController — Ravens of the Realm

exports.send = async (req, res) => {
  try {
    const MessageModel = req.getMessageModel();
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;
    const { recipientId, subject, body } = req.body;

    if (!subject?.trim() || !body?.trim())
      return res.status(400).json({ error: 'Subject and body are required.' });

    if (!recipientId)
      return res.status(400).json({ error: 'Recipient is required.' });

    if (recipientId === me._id.toString())
      return res.status(400).json({ error: 'You cannot message yourself.' });

    const recipient = await WPModel.findById(recipientId).lean();
    if (!recipient) return res.status(404).json({ error: 'Recipient not found in this realm.' });

    const msg = await MessageModel.create({
      senderId:      me._id,
      senderName:    me.username,
      recipientId:   recipient._id,
      recipientName: recipient.username,
      subject:       subject.trim(),
      body:          body.trim(),
      readBy:        [me._id], // sender has "read" their own message
    });

    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendAllianceBroadcast = async (req, res) => {
  try {
    const MessageModel = req.getMessageModel();
    const me = req.worldPlayer;
    const { subject, body } = req.body;

    if (!me.allianceId) return res.status(400).json({ error: 'You are not in an alliance.' });
    if (!['Leader', 'General'].includes(me.allianceRole))
      return res.status(403).json({ error: 'Only Leaders and Generals can broadcast.' });

    if (!subject?.trim() || !body?.trim())
      return res.status(400).json({ error: 'Subject and body are required.' });

    const msg = await MessageModel.create({
      senderId:    me._id,
      senderName:  me.username,
      allianceId:  me.allianceId,
      subject:     subject.trim(),
      body:        body.trim(),
      readBy:      [me._id],
    });

    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInbox = async (req, res) => {
  try {
    const MessageModel = req.getMessageModel();
    const me = req.worldPlayer;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { recipientId: me._id },
        { allianceId: me.allianceId || null, allianceId: { $ne: null } },
      ],
      deletedBy: { $ne: me._id },
    };

    // Fix: proper OR with alliance only when player is in one
    const orClauses = [{ recipientId: me._id }];
    if (me.allianceId) orClauses.push({ allianceId: me.allianceId });

    const [messages, total] = await Promise.all([
      MessageModel.find({ $or: orClauses, deletedBy: { $ne: me._id } })
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MessageModel.countDocuments({ $or: orClauses, deletedBy: { $ne: me._id } }),
    ]);

    const enriched = messages.map(m => ({
      ...m,
      isRead: m.readBy?.some(id => id.toString() === me._id.toString()),
      isAlliance: !!m.allianceId,
    }));

    res.json({ messages: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOutbox = async (req, res) => {
  try {
    const MessageModel = req.getMessageModel();
    const me = req.worldPlayer;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      MessageModel.find({ senderId: me._id, deletedBy: { $ne: me._id } })
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MessageModel.countDocuments({ senderId: me._id, deletedBy: { $ne: me._id } }),
    ]);

    res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMessage = async (req, res) => {
  try {
    const MessageModel = req.getMessageModel();
    const me = req.worldPlayer;
    const { messageId } = req.params;

    const msg = await MessageModel.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    // Access check
    const canRead =
      msg.senderId.toString() === me._id.toString() ||
      msg.recipientId?.toString() === me._id.toString() ||
      (msg.allianceId && me.allianceId && msg.allianceId.toString() === me.allianceId.toString());

    if (!canRead) return res.status(403).json({ error: 'Access denied.' });

    // Mark as read
    if (!msg.readBy.some(id => id.toString() === me._id.toString())) {
      msg.readBy.push(me._id);
      await msg.save();
    }

    res.json({ ...msg.toObject(), isRead: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const MessageModel = req.getMessageModel();
    const me = req.worldPlayer;
    const { messageId } = req.params;

    const msg = await MessageModel.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    if (!msg.deletedBy.some(id => id.toString() === me._id.toString())) {
      msg.deletedBy.push(me._id);
      await msg.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const MessageModel = req.getMessageModel();
    const me = req.worldPlayer;

    const orClauses = [{ recipientId: me._id }];
    if (me.allianceId) orClauses.push({ allianceId: me.allianceId });

    const count = await MessageModel.countDocuments({
      $or: orClauses,
      readBy: { $ne: me._id },
      deletedBy: { $ne: me._id },
    });

    res.json({ unread: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.searchPlayers = async (req, res) => {
  try {
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;
    const { q } = req.query;

    if (!q?.trim()) return res.json({ players: [] });

    const players = await WPModel.find({
      username: { $regex: q.trim(), $options: 'i' },
      _id: { $ne: me._id },
    })
      .select('username kingLevel points')
      .limit(8)
      .lean();

    res.json({ players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
