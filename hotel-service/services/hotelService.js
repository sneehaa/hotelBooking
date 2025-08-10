// services/hotelService.js
const Hotel = require("../models/hotelModel");

function generateRooms(startNumber, count) {
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

async function seedHotels() {
  const existingHotels = await Hotel.find();
  if (existingHotels.length > 0) {
    throw new Error("Hotels already seeded");
  }

  const hotels = [
    {
      name: "Hotel Everest",
      location: "Kathmandu",
      rooms: generateRooms(101, 5),
    },
    {
      name: "Hotel Pokhara Paradise",
      location: "Pokhara",
      rooms: generateRooms(201, 5),
    },
    {
      name: "Hotel Chitwan Jungle",
      location: "Chitwan",
      rooms: generateRooms(301, 5),
    },
  ];

  return await Hotel.insertMany(hotels);
}

async function getAllHotels() {
  return await Hotel.find();
}

async function getHotelById(hotelId) {
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new Error("Hotel not found");
  }
  return hotel;
}

async function searchHotels(location, startDate, endDate) {
  if (!location) {
    throw new Error("Location is required");
  }

  const hotels = await Hotel.find({
    location: { $regex: new RegExp(location, "i") },
  });
  return hotels;
}

module.exports = {
  seedHotels,
  getAllHotels,
  getHotelById,
  searchHotels,
};
