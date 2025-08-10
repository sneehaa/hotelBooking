// importing
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./database/db');

const app = express();


dotenv.config();


connectDB();

// Accepting JSON data

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Booking Service is running');
});

app.use('/api/booking', require('./routes/bookingRoutes'));

const PORT = process.env.PORT

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
