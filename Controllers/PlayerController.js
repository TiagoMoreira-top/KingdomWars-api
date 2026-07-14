const Player = require('../Models/Player');

exports.getProfile = async (req, res) => {
  try {
    const villageModel = req.getVillageModel();
    const worldPlayerModel = req.getWorldPlayerModel();
    const targetPlayerId = req.params.playerId || req.worldPlayer?._id;

    if (!targetPlayerId) {
      return res.status(404).json({ 
        error: "🏰 UNKNOWN MONARCH: Thy records are missing from this realm's scrolls." 
      });
    }

    const worldPlayer = await worldPlayerModel.findById(targetPlayerId).lean();

    if (!worldPlayer) {
      return res.status(404).json({ 
        error: "🏰 VANISHED RULER: That monarch does not exist in these lands." 
      });
    }

    const [masterPlayer, villages] = await Promise.all([
      Player.findById(worldPlayer.masterId).select('joinedAt name').lean(),
      villageModel.find({ ownerId: worldPlayer._id }).select('name points x y').lean()
    ]);

    const totalPoints = villages.reduce((sum, v) => sum + (v.points || 0), 0);

    const profileData = {
      _id: worldPlayer._id,
      username: masterPlayer?.username || worldPlayer.username || "Anonymous King",
      avatar: worldPlayer.avatar || "default_lord.png",
      allianceName: worldPlayer.allianceName || null,
      totalPoints: totalPoints,
      rank: worldPlayer.rank || 0,
      villagesCount: villages.length,
      joinedAt: masterPlayer?.joinedAt || worldPlayer.joinedAt,
      villages: villages,
      kingLevel: worldPlayer.kingLevel || 1,
      kingXP: worldPlayer.kingXP || 0,
      stats: worldPlayer.stats || {},
    };

    res.status(200).json(profileData);

  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ 
      error: "⚡ OMEN: The royal archivist has tripped; thy profile is currently unreadable." 
    });
  }
};