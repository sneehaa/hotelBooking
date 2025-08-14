const axios = require('axios');
const redisClient = require('../utils/redisClient');

class HotelRepository {
    async searchAvailableHotels(location, startDate, endDate) {
        const key = `hotels:${location}:${startDate}:${endDate}`;
        const cached = await redisClient.get(key);
        if (cached) return JSON.parse(cached);

        const { data } = await axios.get(`${process.env.HOTEL_SERVICE_URL}/search`, {
            params: { location, startDate, endDate }
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
