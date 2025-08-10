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
  res.send('Hotel Service is running');
});

app.use('/api/hotel', require('./routes/hotelRoute'));

const PORT = process.env.PORT

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
