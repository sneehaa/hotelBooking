
require('dotenv').config();
const mongoose = require('mongoose');
const hotelService = require('../services/hotelService'); 
const redisClient = require('../utils/redisClient'); 

async function main() {
  try {
    if (!process.env.DB_URL) {
      throw new Error('Please set DB_URL in your .env file');
    }

    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to MongoDB Atlas');

    const hotels = await hotelService.getAllHotels();
    if (!hotels || hotels.length === 0) {
      console.log('No hotels found to reset.');
      process.exit(0);
    }
    for (const hotel of hotels) {
      try {
        await hotelService.resetRoomAvailability(hotel._id);
        console.log(`Reset rooms for hotel: ${hotel.name}`);
      } catch (err) {
        console.error(`Failed to reset rooms for hotel: ${hotel.name}`, err);
      }
    }


    if (redisClient && redisClient.quit) {
      try {
        await redisClient.quit();
        console.log('Redis connection closed');
      } catch {
        console.warn('Redis not reachable, skipped closing');
      }
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('Error resetting hotels:', err);
    process.exit(1);
  }
}

main();
