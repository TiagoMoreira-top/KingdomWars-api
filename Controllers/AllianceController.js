// ⚔️ AllianceController — Brotherhood of the Realm

exports.createAlliance = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const WPModel = req.getWorldPlayerModel();
    const { name, tag, description } = req.body;
    const me = req.worldPlayer;

    if (me.allianceId) return res.status(400).json({ error: 'You are already in an alliance.' });
    if (!name?.trim() || !tag?.trim()) return res.status(400).json({ error: 'Name and tag are required.' });

    const exists = await AllianceModel.findOne({ $or: [{ name: name.trim() }, { tag: tag.trim().toUpperCase() }] });
    if (exists) return res.status(409).json({ error: 'That name or tag is already taken.' });

    const alliance = await AllianceModel.create({
      name: name.trim(),
      tag: tag.trim().toUpperCase(),
      description: description?.trim() || '',
      leaderId: me._id,
      members: [{ playerId: me._id, role: 'Leader' }],
      points: me.points || 0,
    });

    await WPModel.updateOne(
      { _id: me._id },
      { allianceId: alliance._id, allianceRole: 'Leader', allianceName: alliance.name }
    );

    res.status(201).json({ success: true, alliance });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'That name or tag is already taken.' });
    res.status(500).json({ error: 'Could not create alliance: ' + err.message });
  }
};

exports.getMyAlliance = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;

    if (!me.allianceId) return res.status(404).json({ error: 'You are not in an alliance.' });

    const alliance = await AllianceModel.findById(me.allianceId).lean();
    if (!alliance) return res.status(404).json({ error: 'Alliance not found.' });

    const memberIds = alliance.members.map(m => m.playerId);
    const inviteIds = alliance.pendingInvites;

    const [memberPlayers, invitedPlayers] = await Promise.all([
      WPModel.find({ _id: { $in: memberIds } }).select('username points kingLevel').lean(),
      WPModel.find({ _id: { $in: inviteIds } }).select('username').lean(),
    ]);

    const memberMap = Object.fromEntries(memberPlayers.map(p => [p._id.toString(), p]));

    const enrichedMembers = alliance.members.map(m => ({
      ...m,
      username: memberMap[m.playerId.toString()]?.username || '?',
      points: memberMap[m.playerId.toString()]?.points || 0,
      kingLevel: memberMap[m.playerId.toString()]?.kingLevel || 1,
    })).sort((a, b) => {
      const roleOrder = { Leader: 0, General: 1, Member: 2 };
      return (roleOrder[a.role] - roleOrder[b.role]) || (b.points - a.points);
    });

    res.json({ ...alliance, members: enrichedMembers, invitedPlayers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listAlliances = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const { search } = req.query;

    const query = search
      ? { $or: [{ name: { $regex: search, $options: 'i' } }, { tag: { $regex: search, $options: 'i' } }] }
      : {};

    const alliances = await AllianceModel.find(query)
      .sort({ points: -1 })
      .limit(30)
      .lean();

    const enriched = alliances.map(a => ({
      _id: a._id,
      name: a.name,
      tag: a.tag,
      description: a.description,
      points: a.points,
      memberCount: a.members.length,
    }));

    res.json({ alliances: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.invite = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;
    const { targetId } = req.body;

    if (!me.allianceId) return res.status(400).json({ error: 'You are not in an alliance.' });
    if (!['Leader', 'General'].includes(me.allianceRole)) return res.status(403).json({ error: 'Only Leaders and Generals can invite.' });

    const target = await WPModel.findById(targetId).lean();
    if (!target) return res.status(404).json({ error: 'Player not found.' });
    if (target.allianceId) return res.status(400).json({ error: 'That player is already in an alliance.' });

    const alliance = await AllianceModel.findById(me.allianceId);
    if (!alliance) return res.status(404).json({ error: 'Alliance not found.' });
    if (alliance.pendingInvites.some(id => id.toString() === targetId)) {
      return res.status(400).json({ error: 'That player already has a pending invite.' });
    }

    alliance.pendingInvites.push(targetId);
    await alliance.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.respondInvite = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;
    const { allianceId, accept } = req.body;

    if (me.allianceId) return res.status(400).json({ error: 'You are already in an alliance.' });

    const alliance = await AllianceModel.findById(allianceId);
    if (!alliance) return res.status(404).json({ error: 'Alliance not found.' });

    const inviteIndex = alliance.pendingInvites.findIndex(id => id.toString() === me._id.toString());
    if (inviteIndex === -1) return res.status(400).json({ error: 'No pending invite from this alliance.' });

    alliance.pendingInvites.splice(inviteIndex, 1);

    if (accept) {
      alliance.members.push({ playerId: me._id, role: 'Member' });
      alliance.points = (alliance.points || 0) + (me.points || 0);
      await WPModel.updateOne(
        { _id: me._id },
        { allianceId: alliance._id, allianceRole: 'Member', allianceName: alliance.name }
      );
    }

    await alliance.save();
    res.json({ success: true, joined: !!accept });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.leave = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;

    if (!me.allianceId) return res.status(400).json({ error: 'You are not in an alliance.' });
    if (me.allianceRole === 'Leader') return res.status(400).json({ error: 'Leaders must disband or transfer leadership before leaving.' });

    const alliance = await AllianceModel.findById(me.allianceId);
    if (!alliance) return res.status(404).json({ error: 'Alliance not found.' });

    alliance.members = alliance.members.filter(m => m.playerId.toString() !== me._id.toString());
    alliance.points = Math.max(0, (alliance.points || 0) - (me.points || 0));
    await alliance.save();

    await WPModel.updateOne({ _id: me._id }, { allianceId: null, allianceRole: null, allianceName: null });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.kick = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;
    const { targetId } = req.body;

    if (!['Leader', 'General'].includes(me.allianceRole)) return res.status(403).json({ error: 'Only Leaders and Generals can kick members.' });

    const alliance = await AllianceModel.findById(me.allianceId);
    if (!alliance) return res.status(404).json({ error: 'Alliance not found.' });

    const target = alliance.members.find(m => m.playerId.toString() === targetId);
    if (!target) return res.status(404).json({ error: 'Player not in alliance.' });
    if (target.role === 'Leader') return res.status(403).json({ error: 'Cannot kick the Leader.' });
    if (target.role === 'General' && me.allianceRole !== 'Leader') return res.status(403).json({ error: 'Only the Leader can kick Generals.' });

    const targetPlayer = await WPModel.findById(targetId).lean();
    alliance.members = alliance.members.filter(m => m.playerId.toString() !== targetId);
    alliance.points = Math.max(0, (alliance.points || 0) - (targetPlayer?.points || 0));
    await alliance.save();

    await WPModel.updateOne({ _id: targetId }, { allianceId: null, allianceRole: null, allianceName: null });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.promote = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const me = req.worldPlayer;
    const { targetId } = req.body;

    if (me.allianceRole !== 'Leader') return res.status(403).json({ error: 'Only the Leader can promote members.' });

    const alliance = await AllianceModel.findById(me.allianceId);
    if (!alliance) return res.status(404).json({ error: 'Alliance not found.' });

    const target = alliance.members.find(m => m.playerId.toString() === targetId);
    if (!target) return res.status(404).json({ error: 'Player not in alliance.' });
    if (target.role === 'General') return res.status(400).json({ error: 'Player is already a General.' });

    target.role = 'General';
    await alliance.save();

    const WPModel = req.getWorldPlayerModel();
    await WPModel.updateOne({ _id: targetId }, { allianceRole: 'General' });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.disband = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const WPModel = req.getWorldPlayerModel();
    const me = req.worldPlayer;

    if (me.allianceRole !== 'Leader') return res.status(403).json({ error: 'Only the Leader can disband the alliance.' });

    const alliance = await AllianceModel.findById(me.allianceId);
    if (!alliance) return res.status(404).json({ error: 'Alliance not found.' });

    const memberIds = alliance.members.map(m => m.playerId);
    await WPModel.updateMany(
      { _id: { $in: memberIds } },
      { allianceId: null, allianceRole: null, allianceName: null }
    );

    await AllianceModel.deleteOne({ _id: alliance._id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyInvites = async (req, res) => {
  try {
    const AllianceModel = req.getAllianceModel();
    const me = req.worldPlayer;

    const invites = await AllianceModel.find({ pendingInvites: me._id })
      .select('name tag description members points')
      .lean();

    const enriched = invites.map(a => ({
      _id: a._id,
      name: a.name,
      tag: a.tag,
      description: a.description,
      points: a.points,
      memberCount: a.members.length,
    }));

    res.json({ invites: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
