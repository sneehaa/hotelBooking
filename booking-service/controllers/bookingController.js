const bookingService = require('../services/bookingService');

function extractToken(authHeader) {
  return authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;
}

exports.searchAvailableHotels = async (req, res) => {
  try {
    const { location, startDate, endDate } = req.query;

    if (!location || !startDate || !endDate) {
      return res.status(400).json({
        message: "location, startDate, and endDate are required",
      });
    }

    const results = await bookingService.searchAvailableHotels(location, startDate, endDate);
    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createBooking = async (req, res) => {
  try {
    const userId = req.user.userId;  
    const { hotelId, roomNumber, startDate, endDate } = req.body;

    if (!hotelId || !roomNumber || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing booking data" });
    }

    const userToken = req.headers.authorization?.split(" ")[1];  

    const booking = await bookingService.createBooking({
      hotelId,
      roomNumber,
      userId,
      startDate,
      endDate,
      userToken,
    });

    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error("Booking error:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};



exports.cancelBooking = async (req, res) => {
  try {
    const booking = await bookingService.cancelBooking(
      req.params.id,
      req.user.userId,
      extractToken(req.headers.authorization)
    );
    res.json({ success: true, booking });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.payForBooking = async (req, res) => {
  try {
    const userId = req.user.userId; 
    const { bookingId } = req.params;
    const token = extractToken(req.headers.authorization);

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
