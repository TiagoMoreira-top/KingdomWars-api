const World = require('../Models/World');

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
    res.status(500).json({ error: "The Great Library is obscured." });
  }
};

exports.joinWorld = async (req, res) => {
  try {
    const world = await World.findById(req.params.id);
    
    if (!world) return res.status(404).json({ error: "Realm not found." });
    
    if (world.players.includes(req.player._id)) {
      return res.status(200).json({ message: "Already a member of this realm." });
    }

    world.players.push(req.player._id);
    await world.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not join the realm." });
  }
};