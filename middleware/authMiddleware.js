const jwt = require('jsonwebtoken');
const Player = require('../Models/Player'); // Changed from User to Player

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Search the Player archives for the ID found in the cipher
      req.player = await Player.findById(decoded.id).select('-password');
      
      if (!req.player) {
        return res.status(401).json({ error: "No such Player exists in the lineage." });
      }

      next();
    } catch (error) {
      return res.status(401).json({ error: "The token has lost its magic." });
    }
  } else {
    return res.status(401).json({ error: "No token provided to the gatekeeper." });
  }
};

module.exports = { protect };