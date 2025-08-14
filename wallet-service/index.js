const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./database/db');
const walletService = require('./services/walletServices');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Wallet Service Running'));
app.use('/api/wallet', require('./routes/walletRoutes'));

walletService.setupEventListeners();

const PORT = process.env.PORT || 5503;
app.listen(PORT, () => console.log(`Wallet service running on port ${PORT}`));
