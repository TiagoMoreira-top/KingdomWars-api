const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Player = require('../Models/Player');
const Village = require('../Models/Village');

router.post('/register', async (req, res) => {
    try {
        const { email, password, villageName } = req.body;

        const playerExists = await Player.findOne({ email });
        if (playerExists) return res.status(400).json({ error: "Email already registered" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newPlayer = new Player({ 
            email, 
            password: hashedPassword 
        });
        const savedPlayer = await newPlayer.save();

        // Generate a random coordinate between 490 and 510
        const randomX = Math.floor(Math.random() * (510 - 490 + 1)) + 490;
        const randomY = Math.floor(Math.random() * (510 - 490 + 1)) + 490;

        const newVillage = new Village({
            name: villageName,
            ownerId: savedPlayer._id,
            resources: { wood: 500, clay: 500, iron: 400 },
            buildings: { headquarters: 1, timberCamp: 1, clayPit: 1, ironMine: 1 },
            x: randomX,
            y: randomY
        });
        await newVillage.save();

        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const player = await Player.findOne({ email });
        if (!player) return res.status(400).json({ error: "Player not found" });

        const isMatch = await bcrypt.compare(password, player.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        res.json({ playerId: player._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;