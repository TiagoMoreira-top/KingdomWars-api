const express = require('express');
const router = express.Router();
const MovementController = require('../Controllers/MovementController');

// Ensure the endpoint is uppercase if that is your convention
router.post('/send', MovementController.sendTroops); 

module.exports = router;