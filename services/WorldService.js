const getWorldConnection = require('../config/dbManager');
const WorldPlayerSchema = require('../Models/WorldPlayer');

const WorldService = {
    
    async getOrCreateWorldPlayer(player, world) {
        const worldConn = getWorldConnection(world.dbName);
        const WorldPlayerModel = worldConn.model('WorldPlayer', WorldPlayerSchema);

        let worldPlayer = await WorldPlayerModel.findOne({ masterId: player._id });

        if (!worldPlayer) {
            worldPlayer = new WorldPlayerModel({
                masterId: player._id,
                username: player.username || player.name,
                points: 0,
                villagesCount: 0,
                joinedAt: new Date()
            });
            await worldPlayer.save();
        }

        return worldPlayer;
    },

    async updatePlayerStats(playerId, world, statsUpdate) {
        const worldConn = getWorldConnection(world.dbName);
        const WorldPlayerModel = worldConn.model('WorldPlayer', WorldPlayerSchema);

        return await WorldPlayerModel.findOneAndUpdate(
            { playerId },
            { $set: statsUpdate },
            { new: true }
        );
    },

    async incrementVillages(playerId, world) {
        const worldConn = getWorldConnection(world.dbName);
        const WorldPlayerModel = worldConn.model('WorldPlayer', WorldPlayerSchema);

        return await WorldPlayerModel.findOneAndUpdate(
            { playerId },
            { $inc: { villagesCount: 1 } },
            { new: true }
        );
    },

    async getWorldRankings(world, limit = 50) {
        const worldConn = getWorldConnection(world.dbName);
        const WorldPlayerModel = worldConn.model('WorldPlayer', WorldPlayerSchema);

        return await WorldPlayerModel.find()
            .sort({ points: -1 })
            .limit(limit)
            .lean();
    }
};

module.exports = WorldService;