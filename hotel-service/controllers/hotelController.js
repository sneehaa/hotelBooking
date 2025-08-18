const hotelService = require('../services/hotelService');
const hotelRepo = require('../repositories/hotelRepository');

exports.seedHotels = async (req, res) => {
    try {
        const user = req.user;
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: "Forbidden: Only administrators can perform this action." });
        }

        await hotelService.seedHotels();
        res.status(201).json({ message: "Hotels seeded successfully" });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllHotels = async (req, res) => {
  try {
    const hotels = await hotelService.getAllHotels();
    res.status(200).json(hotels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getHotelById = async (req, res) => {
    try {
        const hotel = await hotelRepo.findById(req.params.id);
        if (!hotel) {
            return res.status(404).json({ message: "Hotel not found" });
        }
        res.status(200).json(hotel);  
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};



exports.searchHotels = async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ message: "Location is required" });

    const hotels = await hotelService.searchHotels(location);
    res.status(200).json(hotels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




exports.getRoomPrice = async (req, res) => {
  try {
    const { hotelId, roomNumber } = req.params;

    const hotel = await hotelRepo.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel not found' });
    }

    const room = hotel.rooms.find(r => r.roomNumber == roomNumber);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.json({ success: true, price: room.price });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
