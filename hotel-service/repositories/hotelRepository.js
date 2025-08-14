const Hotel = require('../models/hotelModel');

class HotelRepository {
  async createHotel(data) {
    return await new Hotel(data).save();
  }

  async findAll() {
    return await Hotel.find();
  }

  async findById(id) {
    return await Hotel.findById(id);
  }

  async findByLocation(location) {
    return await Hotel.find({ location: { $regex: new RegExp(location, "i") } });
  }

  async updateRoomAvailability(hotelId, roomNumber, isAvailable) {
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) throw new Error("Hotel not found");

    const room = hotel.rooms.find(r => r.roomNumber === roomNumber);
    if (!room) throw new Error("Room not found");

    room.isAvailable = isAvailable;
    return await hotel.save();
  }
}

module.exports = new HotelRepository();
