// importing
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./database/db');
const cors = require('cors');



// Making express app
const app = express();

// dotenv config
dotenv.config();


// app.use(acceptMultimedia())

// cors config to accept request from frontend
const corsOptions = {
    origin: true,
    credentials: true,
    optionSuccessStatus: 200
};
app.use(cors(corsOptions))

// mongodb connection
connectDB();

// Accepting json data
app.use(express.json());

app.get('/', (req, res) => {
  res.send('User Service is running');
});

// Auth routes (signup, login)
app.use('/api/user', require('./routes/authRoute'));



// defining port
const PORT = process.env.PORT;
// run the server
app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`)
})

// exporting app
module.exports = app;