 const hotelRepository = require("../repositories/hotelRepository");
const redisClient = require("../utils/redisClient");
const rabbitmq = require("../utils/rabbitmq");

const HOTEL_EXCHANGE = process.env.RABBITMQ_EXCHANGE || "hotel_events_exchange";

class HotelService {
  async seedHotels() {
    const existing = await hotelRepository.findAll();
    if (existing.length > 0) throw new Error("Hotels already seeded");

    const hotelsToSeed = [
      {
        name: "Hotel Everest",
        location: "Kathmandu",
        rooms: this.generateRooms(101, 5),
      },
      {
        name: "Hotel Pokhara Paradise",
        location: "Pokhara",
        rooms: this.generateRooms(201, 5),
      },
      {
        name: "Hotel Chitwan Jungle",
        location: "Chitwan",
        rooms: this.generateRooms(301, 5),
      },
      {
        name: "Sauraha Inn",
        location: "Sauraha",
        rooms: this.generateRooms(401, 5),
      },
    ];

    return await Promise.all(
      hotelsToSeed.map((hotel) => hotelRepository.createHotel(hotel))
    );
  }

  generateRooms(startNumber, count) {
    const rooms = [];
    for (let i = 0; i < count; i++) {
      rooms.push({
        roomNumber: startNumber + i,
        price: 2000 + i * 500,
        isAvailable: true,
      });
    }
    return rooms;
  }

  async getAllHotels() {
    const key = "hotels:all";
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);

    const hotels = await hotelRepository.findAll();
    if (hotels.length)
      await redisClient.setEx(key, 300, JSON.stringify(hotels));
    return hotels;
  }

  async getHotelById(hotelId) {
    const key = `hotel:${hotelId}`;
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);

    const hotel = await hotelRepository.findById(hotelId);
    if (!hotel) throw new Error("Hotel not found");

    await redisClient.setEx(key, 3600, JSON.stringify(hotel));
    return hotel;
  }

  async searchHotels(location) {
    const key = `hotels:search:${location}`;
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);

    const hotels = await hotelRepository.findByLocation(location);
    if (hotels.length)
      await redisClient.setEx(key, 300, JSON.stringify(hotels));
    return hotels;
  }

  async handleBookingCreated({ hotelId, roomNumber, bookingId, action = "create" }) {
    console.log(`[HotelService] Handling booking ${action} for hotel ${hotelId}, room ${roomNumber}`);

    try {
      const hotel = await hotelRepository.findById(hotelId);
      if (!hotel) throw new Error("Hotel not found");

      const roomIndex = hotel.rooms.findIndex(r => r.roomNumber === roomNumber);
      if (roomIndex === -1) throw new Error("Room not found");

      hotel.rooms[roomIndex].isAvailable = false;
      await hotel.save();

      const cacheKeys = [
        `hotels:all`,
        `hotel:${hotelId}`,
        `hotels:search:${hotel.location.toLowerCase()}`,
      ];

      await Promise.all(cacheKeys.map(key => redisClient.del(key)));

      console.log(`[HotelService] Successfully updated availability for room ${roomNumber} in hotel ${hotelId}`);
      return true;
    } catch (error) {
      console.error(`[HotelService] Error handling booking ${action}:`, error);
      throw error;
    }
  }

  async handleBookingCancel({ hotelId, roomNumber, bookingId }) {
    const hotel = await hotelRepository.findById(hotelId);
    if (!hotel) throw new Error("Hotel not found");

    const roomIndex = hotel.rooms.findIndex(r => r.roomNumber === roomNumber);
    if (roomIndex === -1) throw new Error("Room not found");

    hotel.rooms[roomIndex].isAvailable = true;
    await hotel.save();

    const cacheKeys = [
      `hotels:all`,
      `hotel:${hotelId}`,
      `hotels:search:${hotel.location.toLowerCase()}`,
    ];

    await Promise.all(cacheKeys.map(key => redisClient.del(key)));

    await rabbitmq.publish(HOTEL_EXCHANGE, "hotel.room.cancelled", { bookingId });

    console.log(`[HotelService] Successfully cancelled booking for room ${roomNumber} in hotel ${hotelId}`);
    return true;
  }

  // -----------------------------
  // NEW METHOD: Reset all room availability
  // -----------------------------
  async resetRoomAvailability(hotelId) {
    const hotel = await hotelRepository.findById(hotelId);
    if (!hotel) throw new Error("Hotel not found");

    hotel.rooms = hotel.rooms.map(room => ({ ...room.toObject(), isAvailable: true }));
    await hotel.save();

    const cacheKeys = [
      `hotels:all`,
      `hotel:${hotelId}`,
      `hotels:search:${hotel.location.toLowerCase()}`,
    ];

    await Promise.all(cacheKeys.map(key => redisClient.del(key)));

    console.log(`[HotelService] Reset all rooms to available for hotel ${hotelId}`);
    return true;
  }
}

module.exports = new HotelService();
