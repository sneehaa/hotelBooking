const hotelService = require('../services/hotelService');

exports.seedHotels = async (req, res) => {
  try {
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
    const hotel = await hotelService.getHotelById(req.params.id);
    res.status(200).json({ hotel });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
