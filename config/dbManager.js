const mongoose = require('mongoose');
const { VillageSchema } = require('../Models/Village');
const { GladiatorSchema } = require('../Models/Gladiator');
const { MissionSchema } = require('../Models/Mission');

const connections = {};

module.exports = (worldDbName) => 
{
    if (connections[worldDbName]) 
    {
        return connections[worldDbName];
    }

    const uri = `${process.env.MONGO_BASE_URI}/${worldDbName}?retryWrites=true&w=majority`;
    
    const conn = mongoose.createConnection(uri);

    // 🏗️ 1. REGISTER MODELS IMMEDIATELY
    // This attaches the schemas to this specific world connection instance
    conn.model('Village', VillageSchema);
    conn.model('Gladiator', GladiatorSchema);
    conn.model('Mission', MissionSchema);
    // Add any others: conn.model('Report', ReportSchema);

    connections[worldDbName] = conn;
    
    console.log(`🌐 REALM LINKED: Connected to world DB [${worldDbName}]`);

    return conn;
};