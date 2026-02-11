const World = require('../Models/World');
const VillageService = require('../services/VillageService');
const WorldService = require('../services/WorldService'); // ⚔️ New Service Import

exports.getAvailableWorlds = async (req, res) => {
    try {
        const worlds = await World.find({ status: 'online' }).lean();
        
        const worldsWithStatus = worlds.map(world => ({
            ...world,
            playerCount: world.players.length,
            isRegistered: world.players.some(id => id.toString() === req.player._id.toString())
        }));

        res.status(200).json(worldsWithStatus);
    } catch (error) {
        res.status(500).json({ error: "⚔️ THE LIBRARY IS OBSCURED: Could not retrieve realms." });
    }
};

exports.joinWorld = async (req, res) => {
    try {
        const world = await World.findById(req.params.id);
        if (!world) return res.status(404).json({ error: "⚔️ ERROR: Realm not found." });

        // 1. 📜 INSCRIBE: Ensure the player has a local WorldPlayer profile
        // This connects to the specific world DB via WorldService
        const worldPlayer = await WorldService.getOrCreateWorldPlayer(req.player, world);

        // 2. Register in Master DB (Global World list)
        if (!world.players.includes(req.player._id)) {
            world.players.push(req.player._id);
            await world.save();
        }

        // 3. 🏰 FOUND: Establish the first village
        const village = await VillageService.createNewVillage(worldPlayer, world);

        // 4. 📈 RECORD: Increment village count in the local world DB
        await WorldService.incrementVillages(worldPlayer._id, world);

        res.status(201).json({ 
            success: true, 
            message: "⚔️ WELCOME LORD: Thy title is recognized and thy village established!",
            village: village,
            worldPlayer: worldPlayer // Returning the local profile to the UI
        });

    } catch (error) {
        res.status(500).json({ 
            error: "⚔️ THE COUNCIL DISAGREES: " + (error.message || "Could not join the realm.") 
        });
    }
};

exports.getMap = async (req, res) => {
  try {
    const { x, y, range } = req.query;
    
    // 🏰 Ensure the scout has coordinates
    if (x === undefined || y === undefined) {
      return res.status(400).json({ error: "⚔️ ERROR: Provide coordinates to scan the horizon." });
    }

    const villageModel = req.getVillageModel();
    const centerX = parseInt(x);
    const centerY = parseInt(y);
    const r = Math.min(parseInt(range) || 10, 30); // Limit range to prevent scroll overflow

    const minX = centerX - r;
    const maxX = centerX + r;
    const minY = centerY - r;
    const maxY = centerY + r;

    // ⚔️ Fetch only villages within the visible boundaries
    const villages = await villageModel.find({
      x: { $gte: minX, $lte: maxX },
      y: { $gte: minY, $lte: maxY }
    }).select('name x y ownerId ownerName points').lean();

    const tiles = [];

    // 📜 Generate the grid from North-West to South-East
    for (let iy = minY; iy <= maxY; iy++) {
      for (let ix = minX; ix <= maxX; ix++) {
        const foundVillage = villages.find(v => v.x === ix && v.y === iy);

        tiles.push({
          x: ix,
          y: iy,
          village: foundVillage ? {
            _id: foundVillage._id,
            name: foundVillage.name,
            ownerName: foundVillage.ownerName,
            points: foundVillage.points,
            // 🛡️ Determine if this is thy own keep or a rival's
            isOwn: foundVillage.ownerId.toString() === req.worldPlayer._id.toString()
          } : null
        });
      }
    }

    res.status(200).json({
      centerX,
      centerY,
      range: r,
      tiles
    });

  } catch (error) {
    console.error("Map Fetch Error:", error);
    res.status(500).json({ 
      error: "⚡ OMEN: The royal cartographer has lost his way." 
    });
  }
};

exports.getWorldCensus = async (req, res) => {
  try {
    const villageModel = req.getVillageModel();
    
    // 🕊️ We only fetch the bare essentials: X, Y, and Owner for the entire world
    const villages = await villageModel.find({})
      .select('x y ownerId')
      .lean();

    const formattedVillages = villages.map(v => ({
      x: v.x,
      y: v.y,
      isOwn: v.ownerId.toString() === req.worldPlayer._id.toString()
    }));

    res.status(200).json({ villages: formattedVillages });
  } catch (error) {
    res.status(500).json({ error: "⚡ OMEN: Could not count the kingdom's keeps." });
  }
};

exports.getWorldRankings = async (req, res) => {
  try {
    const worldPlayerModel = req.getWorldPlayerModel();
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [rankings, totalPlayers] = await Promise.all([
      worldPlayerModel.find({})
        .sort({ points: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      worldPlayerModel.countDocuments({})
    ]);

    const formattedRankings = rankings.map((player, index) => ({
      _id: player._id,
      username: player.username,
      allianceName: player.allianceName || "Stateless Wanderer",
      points: player.points || 0,
      villagesCount: player.villagesCount || 0,
      rank: skip + index + 1
    }));

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(totalPlayers / limit),
      totalPlayers,
      rankings: formattedRankings
    });

  } catch (error) {
    console.error("Ranking Fetch Error:", error);
    res.status(500).json({ 
      error: "⚡ OMEN: The Great Ledger is torn; the rankings are currently hidden from sight." 
    });
  }
};