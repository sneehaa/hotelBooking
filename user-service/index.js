const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./database/db");

const app = express();

dotenv.config();

connectDB();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("User Service is running");
});

app.use("/api/user", require("./routes/authRoute"));

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
