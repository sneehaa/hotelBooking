const bookingService = require('../services/bookingService');

exports.searchAvailableHotels = async (req, res) => {
  try {
    const { location, startDate, endDate } = req.query;

    if (!location || !startDate || !endDate) {
      return res.status(400).json({
        message: "location, startDate, and endDate are required",
      });
    }

    const results = await bookingService.searchAvailableHotels(
      location,
      startDate,
      endDate
    );

    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userToken = req.headers.authorization.split(' ')[1];
    const { hotelId, roomNumber, startDate, endDate } = req.body;

    if (!hotelId || !roomNumber || !userId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing booking data' });
    }

    const booking = await bookingService.createBooking({
      hotelId,
      roomNumber,
      userId,
      startDate,
      endDate,
      userToken,  // Pass token for wallet service auth
    });

    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.payForBooking = async (req, res) => {
  try {
    const userId = req.user.userId; 
    const { bookingId } = req.params;

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authorization token missing" });
    }

    const updatedBooking = await bookingService.payForBooking(bookingId, userId, token);

    res.status(200).json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};


exports.getBookingsByUser = async (req, res) => {
  try {
    const requestedUserId = req.params.userId;

    if (requestedUserId !== req.user.userId) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }

    const bookings = await bookingService.getBookingsByUser(requestedUserId);

    res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
