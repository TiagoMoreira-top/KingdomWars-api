const cron = require('node-cron');
const BarbarianService = require('./BarbarianService');
const World = require('../Models/World');
const getWorldConnection = require('../config/dbManager');
const WorldPlayerSchema = require('../Models/WorldPlayer');
const { VillageSchema } = require('../Models/Village');
const { DragonEggSchema } = require('../Models/DragonEgg');

const HALL_OF_FAME_SIZE = 10;

async function checkWorld(world) {
  if (world.status !== 'online') return;

  const worldConn = getWorldConnection(world.dbName);
  const WPModel = worldConn.models.WorldPlayer || worldConn.model('WorldPlayer', WorldPlayerSchema);

  // Find the top player by points
  const top = await WPModel.find({})
    .sort({ points: -1 })
    .limit(HALL_OF_FAME_SIZE)
    .lean();

  if (!top.length) return;

  const leader = top[0];
  if ((leader.points || 0) < world.victoryThreshold) return;

  console.log(`⚔️ VICTORY: ${leader.username} has conquered world "${world.name}" with ${leader.points} points!`);

  const hallOfFame = top.map((p, i) => ({
    rank:      i + 1,
    playerId:  p._id,
    username:  p.username,
    points:    p.points || 0,
    kingLevel: p.kingLevel || 1,
    stats: {
      battlesWon:    p.stats?.battlesWon    || 0,
      troopsKilled:  p.stats?.troopsKilled  || 0,
      dragonsHatched: p.stats?.dragonsHatched || 0,
    }
  }));

  await World.findByIdAndUpdate(world._id, {
    status: 'ended',
    endedAt: new Date(),
    winner: {
      playerId: leader._id,
      username: leader.username,
      points:   leader.points,
    },
    hallOfFame,
  });
}

// Seed dragon eggs: ~15% of villages get one at world start (runs once per world)
async function seedDragonEggs(world) {
  try {
    const worldConn = getWorldConnection(world.dbName);
    const VillageModel = worldConn.models.Village || worldConn.model('Village', VillageSchema);
    const DragonEggModel = worldConn.models.DragonEgg || worldConn.model('DragonEgg', DragonEggSchema);

    const existingEggs = await DragonEggModel.countDocuments({});
    if (existingEggs > 0) return; // already seeded

    const villages = await VillageModel.find({}).select('_id').lean();
    if (villages.length === 0) return;

    // Pick ~15% of villages
    const candidates = villages.filter(() => Math.random() < 0.15);
    if (candidates.length === 0 && villages.length > 0) {
      candidates.push(villages[Math.floor(Math.random() * villages.length)]);
    }

    for (const v of candidates) {
      const egg = await new DragonEggModel({ villageId: v._id }).save();
      await VillageModel.findByIdAndUpdate(v._id, { dragonEgg: egg._id });
    }

    console.log(`🥚 Dragon Eggs seeded: ${candidates.length} eggs hidden in ${world.name}`);
  } catch (e) {
    console.error('Egg seeding error:', e.message);
  }
}

async function runVictoryCheck() {
  try {
    const worlds = await World.find({ status: 'online' }).lean();
    await Promise.all(worlds.map(checkWorld));
  } catch (err) {
    console.error('⚔️ VICTORY CHECK ERROR:', err.message);
  }
}

async function runEggSeeding() {
  try {
    const worlds = await World.find({ status: 'online' }).lean();
    await Promise.all(worlds.map(seedDragonEggs));
  } catch (err) {
    console.error('🥚 EGG SEEDING ERROR:', err.message);
  }
}

function startVictoryCron() {
  cron.schedule('*/30 * * * *', runVictoryCheck);
  // Seed eggs once on startup and then every 6 hours (for new worlds)
  runEggSeeding();
  cron.schedule('0 */6 * * *', runEggSeeding);
  console.log('⚔️ Victory Cron: watching the realm every 30 minutes.');

  // 🪓 The countryside: topped up every four hours, stirs every hour.
  const runBarbarians = async (job) => {
    try {
      const worlds = await World.find({ status: 'online' }).lean();
      for (const w of worlds) await job(w);
    } catch (err) {
      console.error('🪓 BARBARIAN ERROR:', err.message);
    }
  };

  const { BARBARIANS } = require('../config/barbarians');
  runBarbarians(w => BarbarianService.ensurePopulated(w));
  cron.schedule(BARBARIANS.SEED_CRON, () => runBarbarians(w => BarbarianService.ensurePopulated(w)));
  cron.schedule(BARBARIANS.GROWTH_CRON, () => runBarbarians(w => BarbarianService.grow(w)));
  console.log('🪓 Barbarian Cron: the countryside stirs hourly.');
}

module.exports = { startVictoryCron, runVictoryCheck, seedDragonEggs };
