const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./Routes/Auth');
const Village = require('./Models/Village');
const Movement = require('./Models/Movement');

const villageRoutes = require('./Routes/VillageRoutes');
const movementRoutes = require('./Routes/MovementRoutes');

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true // Required to allow cookies to pass through
}));

app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Connection error:', err));

app.use('/api/village', villageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/movement', movementRoutes);

setInterval(async () => {
    try {
        const villages = await Village.find({});
        const bulkOps = villages.map(v => {
            const woodGain = (v.buildings.timberCamp * 20) + 2;
            const clayGain = (v.buildings.clayPit * 20) + 2;
            const ironGain = (v.buildings.ironMine * 15) + 1;

            return {
                updateOne: {
                    filter: { _id: v._id },
                    update: {
                        $inc: {
                            "resources.wood": woodGain,
                            "resources.clay": clayGain,
                            "resources.iron": ironGain
                        }
                    }
                }
            };
        });

        if (bulkOps.length > 0) {
            await Village.bulkWrite(bulkOps);
        }
        console.log(`[Economy] Resources generated for ${villages.length} villages.`);
    } catch (err) {
        console.error("Economy heartbeat failed:", err);
    }
}, 60000);

setInterval(async () => {
    try {
        const march = await Movement.findOneAndUpdate(
            { 
                arrivalTime: { $lte: new Date() }, 
                isCompleted: false 
            }, 
            { $set: { isCompleted: true } }, 
            { new: true }
        );

        if (march) {
            console.log(`⚔️ Processing arrival for movement: ${march._id}`);
            // This now works because of the import at the top
            await processAttack(march);
        }
    } catch (err) {
        // This will likely say "processAttack is not defined" until you add the import
        console.error("Ticker Error:", err.message);
    }
}, 3000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});