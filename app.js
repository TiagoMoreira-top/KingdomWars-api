const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./Routes/Auth');
const worldRoutes = require('./Routes/WorldRoutes');

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true // Required to allow cookies to pass through
}));

app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.MONGO_MASTER_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Connection error:', err));

// 2. WORLD CONNECTIONS: Store them in an object for reuse
const worldConnections = {};

async function getWorldDB(dbName) {
    if (worldConnections[dbName]) return worldConnections[dbName];

    const conn = await mongoose.createConnection(
        `${process.env.MONGO_URI}/${dbName}`
    ).asPromise();
    
    worldConnections[dbName] = conn;
    console.log(`Connected to World: ${dbName}`);
    return conn;
}

app.use('/api/auth', authRoutes);
app.use('/worlds', worldRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});