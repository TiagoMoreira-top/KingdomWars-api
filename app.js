const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./Routes/Auth');
const worldRoutes = require('./Routes/WorldRoutes');
const villageRoutes = require('./Routes/VillageRoutes');
const playerRoutes = require('./Routes/PlayerRoutes');
const ReportRoutes = require('./Routes/ReportRoutes');
const GladiatorRoutes = require('./Routes/GladiatorRoutes');
const MarketRoutes = require('./Routes/MarketRoutes');
const AllianceRoutes = require('./Routes/AllianceRoutes');
const MessageRoutes  = require('./Routes/MessageRoutes');
const ResearchRoutes = require('./Routes/ResearchRoutes');
const QuestRoutes    = require('./Routes/QuestRoutes');
const KingRoutes     = require('./Routes/KingRoutes');
const { startVictoryCron } = require('./services/VictoryService');

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
app.use('/players', playerRoutes);
app.use('/reports', ReportRoutes);
app.use('/gladiators', GladiatorRoutes);
app.use('/market', MarketRoutes);
app.use('/alliances', AllianceRoutes);
app.use('/messages',  MessageRoutes);
app.use('/villages',  ResearchRoutes);
app.use('/villages',  QuestRoutes);
app.use('/worlds',    KingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startVictoryCron();
});