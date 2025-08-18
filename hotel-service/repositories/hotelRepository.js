const Hotel = require("../models/hotelModel");

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
    return await Hotel.find({
      location: { $regex: new RegExp(location, "i") },
    });
  }

  async updateRoomAvailability(hotelId, roomNumber, isAvailable) {
    try {
      const result = await Hotel.findOneAndUpdate(
        {
          _id: hotelId,
          "rooms.roomNumber": roomNumber,
        },
        {
          $set: { "rooms.$.isAvailable": isAvailable },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!result) {
        throw new Error(`Room ${roomNumber} not found in hotel ${hotelId}`);
      }

      console.log(
        `[HotelRepository] Updated availability for room ${roomNumber} in hotel ${hotelId} to ${isAvailable}`
      );
      return result;
    } catch (error) {
      console.error(
        "[HotelRepository] Error updating room availability:",
        error
      );
      throw error;
    }
  }
}

module.exports = new HotelRepository();
