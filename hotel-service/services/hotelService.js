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
    ];

    // Use Promise.all to create each hotel individually.
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

  // Event-driven handlers
  async handleBookingRequest({ hotelId, roomNumber, bookingId }) {
    // Mark room as unavailable
    await hotelRepository.updateRoomAvailability(hotelId, roomNumber, false);

    // Confirm room hold
    await rabbitmq.publish(HOTEL_EXCHANGE, "hotel.room.hold.confirmed", {
      bookingId,
    });
  }

  async handleBookingCancel({ hotelId, roomNumber, bookingId }) {
    // Mark room as available
    await hotelRepository.updateRoomAvailability(hotelId, roomNumber, true);

    // Confirm cancellation
    await rabbitmq.publish(HOTEL_EXCHANGE, "hotel.room.cancelled", {
      bookingId,
    });
  }
}

module.exports = new HotelService();
