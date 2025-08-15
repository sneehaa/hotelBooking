const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./database/db');
const rabbitmq = require('./utils/rabbitmq');
const { setupEventListeners } = require('./events/eventListener');

const app = express();
dotenv.config();
connectDB();
app.use(express.json());


app.use('/api/hotel', require('./routes/hotelRoute'));
app.get('/', (req, res) => res.send('Hotel Service is running'));

rabbitmq.connect().then(() => {
  setupEventListeners();
});

const PORT = process.env.PORT || 5501;
app.listen(PORT, () => console.log(`Hotel Service running on port ${PORT}`));
