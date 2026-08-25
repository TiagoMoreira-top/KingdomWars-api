const getWorldConnection = require('../config/dbManager');
const { VillageSchema } = require('../Models/Village');
const WorldPlayerSchema = require('../Models/WorldPlayer');
const BUILDINGS = require('../config/buildings');
const { BARBARIANS, rollTier, garrisonFor } = require('../config/barbarians');

/**
 * 🪓 THE COUNTRYSIDE
 *
 * Seeds and slowly grows the unclaimed holdings of a world.
 *
 * Everything here is idempotent: seeding tops a world up to a target rather
 * than adding blindly, and growth is capped per holding by its tier. Running
 * any of it twice is harmless, which matters because the cron and the join
 * hook can both fire at once.
 */

const models = (world) => {
  const conn = getWorldConnection(world.dbName);
  return {
    conn,
    Village: conn.models.Village || conn.model('Village', VillageSchema),
    WorldPlayer: conn.models.WorldPlayer || conn.model('WorldPlayer', WorldPlayerSchema),
  };
};

const BarbarianService = {
  /**
   * The sentinel who holds every barbarian village in a world. One per world,
   * created on demand. Flagged so rankings and the census can exclude it.
   */
  async getOwner(world) {
    const { WorldPlayer } = models(world);

    let owner = await WorldPlayer.findOne({ isBarbarian: true });
    if (owner) return owner;

    // masterId is unique and required; a deterministic sentinel id keeps this
    // idempotent even if two callers race here.
    const mongoose = require('mongoose');
    const sentinelId = new mongoose.Types.ObjectId('000000000000000000000b0b');

    try {
      owner = await WorldPlayer.create({
        masterId: sentinelId,
        username: BARBARIANS.OWNER_NAME,
        isBarbarian: true,
        points: 0,
      });
    } catch (err) {
      // Lost the race — the other caller made it
      owner = await WorldPlayer.findOne({ isBarbarian: true });
      if (!owner) throw err;
    }
    return owner;
  },

  /** Build one holding's starting state from its tier. */
  buildVillage({ ownerId, worldId, x, y, tier }) {
    const t = BARBARIANS.TIERS.find(v => v.tier === tier) || BARBARIANS.TIERS[0];
    // Start part-grown so the countryside is not uniformly level 1
    const startLevel = Math.max(1, Math.floor(t.capLevel * 0.35));

    const buildings = {};
    for (const key of BARBARIANS.GROWABLE) {
      buildings[key] = Math.min(startLevel, t.capLevel);
    }
    // The wall lags, so early holdings stay takeable
    buildings.wall = Math.max(0, Math.floor(startLevel / 2));

    const points = Object.entries(buildings).reduce((sum, [key, lvl]) => {
      const cfg = BUILDINGS[key];
      return sum + (cfg ? (cfg.pointValue || 2) * lvl : 0);
    }, 0);

    return {
      name: t.name,
      ownerId,
      worldId,
      x, y,
      isBarbarian: true,
      barbarianTier: tier,
      points,
      buildings,
      army: garrisonFor(tier, startLevel),
      resources: {
        wood: 500 + startLevel * 400,
        clay: 500 + startLevel * 400,
        stone: 500 + startLevel * 400,
        gold: 0,
        maxStorage: 100000,
        maxGold: 0,
      },
      population: { habitants: 1000, used: 0 },
      lastResourceUpdate: new Date(),
    };
  },

  /**
   * Place `count` holdings at free coordinates. Returns how many were actually
   * planted — collisions are skipped, never retried forever.
   */
  async plant(world, count, { centre = null, minR = 0, maxR = 500 } = {}) {
    if (count <= 0) return 0;
    const { Village } = models(world);
    const owner = await this.getOwner(world);

    let planted = 0;
    let attempts = 0;
    const maxAttempts = count * 12;

    while (planted < count && attempts < maxAttempts) {
      attempts++;

      let x, y;
      if (centre) {
        // A ring around the given point, so a new lord has a short march
        const angle = Math.random() * Math.PI * 2;
        const dist = minR + Math.random() * (maxR - minR);
        x = Math.round(centre.x + Math.cos(angle) * dist);
        y = Math.round(centre.y + Math.sin(angle) * dist);
      } else {
        x = Math.floor(Math.random() * 1000);
        y = Math.floor(Math.random() * 1000);
      }

      if (x < 0 || x > 999 || y < 0 || y > 999) continue;
      if (await Village.exists({ x, y })) continue;

      const tier = rollTier(Math.random()).tier;
      try {
        await Village.create(this.buildVillage({
          ownerId: owner._id,
          worldId: world._id,
          x, y, tier,
        }));
        planted++;
      } catch (_) {
        // Unique index on (worldId,x,y) lost a race — try elsewhere
      }
    }

    return planted;
  },

  /** Top a world up to its target population of barbarian holdings. */
  async ensurePopulated(world) {
    const { Village } = models(world);
    const existing = await Village.countDocuments({ isBarbarian: true });
    const missing = BARBARIANS.TARGET_COUNT - existing;
    if (missing <= 0) return { existing, planted: 0 };

    const planted = await this.plant(world, missing);
    return { existing, planted };
  },

  /** Scatter a few holdings around a lord who has just landed. */
  async seedNeighbours(world, x, y) {
    return this.plant(world, BARBARIANS.NEIGHBOURS_ON_JOIN, {
      centre: { x, y },
      minR: BARBARIANS.NEIGHBOUR_MIN_RADIUS,
      maxR: BARBARIANS.NEIGHBOUR_MAX_RADIUS,
    });
  },

  /**
   * One growth tick. Each holding may raise a single structure toward its cap
   * and re-muster its garrison to match. A holding at its cap is left alone,
   * which is what stops the countryside from becoming uniformly lethal.
   */
  async grow(world) {
    const { Village } = models(world);
    const holdings = await Village.find({ isBarbarian: true });

    let grown = 0;
    for (const v of holdings) {
      if (Math.random() > BARBARIANS.GROWTH_CHANCE) continue;

      const tier = BARBARIANS.TIERS.find(t => t.tier === (v.barbarianTier || 1)) || BARBARIANS.TIERS[0];

      // Which structures still have room below the cap?
      const room = BARBARIANS.GROWABLE.filter(k => (v.buildings[k] || 0) < tier.capLevel);
      if (room.length === 0) continue;

      const key = room[Math.floor(Math.random() * room.length)];
      v.buildings[key] = (v.buildings[key] || 0) + 1;

      const cfg = BUILDINGS[key];
      v.points = (v.points || 0) + (cfg ? (cfg.pointValue || 2) : 2);

      // Re-muster to match the holding's new development
      const level = v.buildings.greatHall || 1;
      const army = garrisonFor(tier.tier, level);
      for (const [unit, n] of Object.entries(army)) {
        // Never shrink a garrison a player has already fought down
        v.army[unit] = Math.max(v.army[unit] || 0, n);
      }

      v.markModified('buildings');
      v.markModified('army');
      await v.save();
      grown++;
    }

    return { holdings: holdings.length, grown };
  },
};

module.exports = BarbarianService;
