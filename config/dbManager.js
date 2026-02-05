const mongoose = require('mongoose');
const connections = {};

// Use module.exports directly for the function
module.exports = (worldDbName) => {
  if (connections[worldDbName]) return connections[worldDbName];

  const uri = `${process.env.MONGO_BASE_URI}/${worldDbName}?retryWrites=true&w=majority`;
  
  const conn = mongoose.createConnection(uri);
  connections[worldDbName] = conn;
  return conn;
};