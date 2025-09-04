const express = require('express');
const dotenv = require('dotenv');
const rabbitmq = require('./utils/rabbitmq');
const connectDB = require('./database/db');
const { setupEventListeners } = require('./events/eventListener');


dotenv.config();
connectDB();

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Wallet Service Running'));
app.use('/api/wallet', require('./routes/walletRoutes'));

rabbitmq.connect()
    .then(() => setupEventListeners()) 
    .catch(err => console.error('Failed to connect to RabbitMQ:', err));

const PORT = process.env.PORT || 5503;
app.listen(PORT, () => console.log(`Wallet service running on port ${PORT}`));