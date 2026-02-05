const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./Routes/Auth');
const worldRoutes = require('./Routes/WorldRoutes');
const villageRoutes = require('./Routes/VillageRoutes');

const app = express();

app.use(cors({
  /* origin: [
    'http://localhost:3000', 
    'https://kingdom-wars.vercel.app/'
  ], */
  credentials: true // Required to allow cookies to pass through
}));

app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.MONGO_MASTER_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/worlds', worldRoutes);
app.use('/villages', villageRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});