const axios = require('axios');
const redisClient = require('../utils/redisClient');

class HotelRepository {
    async getRoomPrice(hotelId, roomNumber) {
    try {
      const { data } = await axios.get(`${process.env.HOTEL_SERVICE_URL}/hotels/${hotelId}/rooms/${roomNumber}`, {
        timeout: 5000
      });
      
      if (!data || !data.price) {
        throw new Error('Invalid room data received');
      }
      
      return data.price;
    } catch (error) {
      console.error("Failed to get room price:", error.message);
      throw new Error(`Could not fetch room price: ${error.message}`);
    }
  }
    async searchAvailableHotels(location) {
        const key = `hotels:${location}`;
        const cached = await redisClient.get(key);
        if (cached) return JSON.parse(cached);

        const { data } = await axios.get(`${process.env.HOTEL_SERVICE_URL}/search`, {
            params: { location }
        });

        const results = Array.isArray(data) ? data : (data.results || []);
        if (results.length) await redisClient.setEx(key, 300, JSON.stringify(results));
        return results;
    }

    async getHotelById(hotelId) {
        const key = `hotel:${hotelId}`;
        const cached = await redisClient.get(key);
        if (cached) return JSON.parse(cached);

        const { data } = await axios.get(`${process.env.HOTEL_SERVICE_URL}/${hotelId}`);
        if (data?.hotel) await redisClient.setEx(key, 3600, JSON.stringify(data.hotel));
        return data.hotel;
    }

    async getRoomPrice(hotelId, roomNumber) {
        const hotel = await this.getHotelById(hotelId);
        const room = hotel?.rooms?.find(r => r.roomNumber === roomNumber);
        if (!room) throw new Error('Room not found');
        return room.price;
    }
}

module.exports = new HotelRepository();
