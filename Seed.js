const mongoose = require('mongoose');
require('dotenv').config();
const Village = require('./Models/Village');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_BASE_URI);
    
    const newVillage = new Village({
      owner: new mongoose.Types.ObjectId(), 
      name: "Stonehelm",
      resources: {
        wood: 1000,
        clay: 1000,
        iron: 1000,
        lastUpdate: new Date()
      },
      buildings: {
        headquarters: 1,
        timberCamp: 1,
        clayPit: 1,
        ironMine: 1
      },
      queue: []
    });

    const saved = await newVillage.save();
    console.log('-------------------------------');
    console.log('Village created successfully!');
    console.log('COPY THIS ID:', saved._id);
    console.log('-------------------------------');
    
    process.exit();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seed();