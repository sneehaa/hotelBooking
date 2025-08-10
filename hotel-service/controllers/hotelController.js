const hotelService = require('../services/hotelService');

exports.seedHotels = async (req, res) => {
  try {
    await hotelService.seedHotels();
    res.status(201).json({ message: 'Hotels and rooms seeded successfully' });
  } catch (err) {
    console.error('Error during seeding:', err.message);
    console.error(err.stack);
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
    res.status(200).json({ success: true, hotel });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.searchHotels = async (req, res) => {
  try {
    const { location, startDate, endDate } = req.query;
    if (!location || !startDate || !endDate) {
      return res.status(400).json({ message: 'location, startDate, and endDate are required' });
    }
    const results = await hotelService.searchHotels(location, startDate, endDate);
    res.status(200).json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
