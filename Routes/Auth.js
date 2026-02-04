const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // The magic ink
const Player = require('../Models/Player');

router.post('/register', async (req, res) => {
    try {
        const { name, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({ error: "Name and cipher are required to enlist." });
        }

        const playerExists = await Player.findOne({ name: name.toLowerCase() });
        if (playerExists) {
            return res.status(400).json({ error: "That name is already etched in the chronicles." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newPlayer = new Player({ 
            name: name,
            password: hashedPassword 
        });
        
        await newPlayer.save();

        // Forge the token immediately so they don't have to log in right after registering
        const token = jwt.sign({ id: newPlayer._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ 
            success: true, 
            token, // Send the magic scroll
            player: { id: newPlayer._id, name: newPlayer.name }
        });
    } catch (err) {
        res.status(500).json({ error: "The scribes failed to record thy name." });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { name, password } = req.body;

        const player = await Player.findOne({ name: name.toLowerCase() });
        if (!player) {
            return res.status(400).json({ error: "No such warrior found." });
        }

        const isMatch = await bcrypt.compare(password, player.password);
        if (!isMatch) {
            return res.status(400).json({ error: "The secret cipher is incorrect." });
        }

        // Forge the magic seal
        const token = jwt.sign({ id: player._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({ 
            success: true,
            token, // This is what the middleware looks for!
            playerId: player._id,
            name: player.name 
        });
    } catch (err) {
        res.status(500).json({ error: "The gates are jammed. Try again later." });
    }
});

module.exports = router;