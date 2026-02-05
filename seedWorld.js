const mongoose = require('mongoose');
const World = require('./Models/World');
require('dotenv').config();

const createWorld = async () => {
  try {
    await mongoose.connect(process.env.MONGO_MASTER_URI);

    const initialWorld = {
      name: "Valhalla",
      description: "The eternal battleground for the greatest Warlords.",
      status: "online",
      playerCount: 0,
      maxPlayers: 1000,
      worldUrl: "http://localhost:5000",
      players: [],
      dbName: "world_1",
    };

    const existingWorld = await World.findOne({ name: initialWorld.name });

    if (existingWorld) {
      console.log("⚠️ This realm already exists in the archives.");
    } else {
      await World.create(initialWorld);
      console.log("✅ Realm 'Valhalla' has been successfully carved into the database.");
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ The ritual failed:", error);
    process.exit(1);
  }
};

createWorld();