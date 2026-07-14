const World = require('../Models/World');
const getWorldConnection = require('../config/dbManager');
const { VillageSchema } = require('../Models/Village');
const WorldPlayerSchema = require('../Models/WorldPlayer'); // ⚔️ New Import
const MissionSchema = require('../Models/Mission');
const GladiatorSchema = require('../Models/Gladiator');
const { DragonSchema } = require('../Models/Dragon');
const MarketOfferSchema = require('../Models/MarketOffer');
const AllianceSchema = require('../Models/Alliance');
const MessageSchema  = require('../Models/Message');
const { DragonEggSchema } = require('../Models/DragonEgg');

const worldCache = {};

module.exports = async (req, res, next) => {
  try {
    const { worldId } = req.params;

    if (!worldId) {
      return res.status(400).json({ error: "⚔️ UNKNOWN REALM: No world ID provided." });
    }

    // 1. Get World Info (from Cache or DB)
    let world = worldCache[worldId];
    if (!world) {
      world = await World.findById(worldId).lean();
      if (!world) return res.status(404).json({ error: "⚔️ VOID: That realm does not exist." });
      worldCache[worldId] = world;
    }

    // 2. Resolve the Connection
    const worldConn = getWorldConnection(world.dbName);
    
    // 3. 🛡️ VERIFY LOCAL PERSONA: Check if the Lord exists in this specific realm
    const WorldPlayerModel = worldConn.model('WorldPlayer', WorldPlayerSchema);
    const worldPlayer = await WorldPlayerModel.findOne({ masterId: req.player._id }).lean();

    if (!worldPlayer) {
      return res.status(403).json({ 
        error: "⚔️ EXILE: Thou hast no standing in this realm. Join the world first!" 
      });
    }

    // 4. Attach the connection, World info, and WorldPlayer to the request
    req.world = world;
    req.worldConn = worldConn;
    req.worldPlayer = worldPlayer; // 👑 The Local Lord is now available to all controllers!

    req.getGladiatorModel = () => {
      return worldConn.models.Gladiator || worldConn.model('Gladiator', GladiatorSchema);
    };

    req.getDragonModel = () => {
      return worldConn.models.Dragon || worldConn.model('Dragon', DragonSchema);
    };
    
    // Helpers to get models quickly in controllers
    req.getVillageModel = () => {
      return worldConn.models.Village || worldConn.model('Village', VillageSchema);
    };

    req.getMissionModel = () => {
      return worldConn.models.Mission || worldConn.model('Mission', MissionSchema);
    };

    req.getMarketOfferModel = () => {
      return worldConn.models.MarketOffer || worldConn.model('MarketOffer', MarketOfferSchema);
    };

    req.getWorldPlayerModel = () => WorldPlayerModel;

    req.getAllianceModel = () => {
      return worldConn.models.Alliance || worldConn.model('Alliance', AllianceSchema);
    };

    req.getMessageModel = () => {
      return worldConn.models.Message || worldConn.model('Message', MessageSchema);
    };

    req.getDragonEggModel = () => {
      return worldConn.models.DragonEgg || worldConn.model('DragonEgg', DragonEggSchema);
    };

    next();
  } catch (error) {
    res.status(500).json({ error: "⚔️ GATE ERROR: The bridge to the realm is blocked." });
  }
};