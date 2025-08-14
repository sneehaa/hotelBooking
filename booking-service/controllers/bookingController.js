const bookingService = require('../services/bookingService');

exports.searchAvailableHotels = async (req, res) => {
    try {
        const { location, startDate, endDate } = req.query;
        const results = await bookingService.searchAvailableHotels(location, startDate, endDate);
        res.status(200).json({ success: true, results });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.createBooking = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { hotelId, roomNumber, startDate, endDate } = req.body;
    
    // First check room availability
    const isAvailable = await bookingService.checkRoomAvailability(
      hotelId, 
      roomNumber,
      startDate,
      endDate
    );
    
    if (!isAvailable) {
      return res.status(400).json({ 
        success: false, 
        message: "Room not available for selected dates" 
      });
    }
    
    // Then verify wallet balance
    const price = await bookingService.getRoomPrice(hotelId, roomNumber);
    const requiredAmount = price + 5; // service fee
    
    const hasSufficientFunds = await bookingService.checkWalletBalance(
      userId,
      requiredAmount
    );
    
    if (!hasSufficientFunds) {
      return res.status(400).json({ 
        success: false, 
        message: "Insufficient funds in wallet" 
      });
    }
    
    const booking = await bookingService.createBooking(
      userId,
      hotelId,
      roomNumber,
      startDate,
      endDate,
      price
    );
    
    res.status(201).json({ 
      success: true, 
      booking,
      message: "Booking created successfully" 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
exports.cancelBooking = async (req, res) => {
    try {
        const userId = req.user.userId;
        await bookingService.requestCancellation(userId, req.params.id);
        res.status(202).json({ success: true, message: "Cancellation request received" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.payForBooking = async (req, res) => {
    try {
        const userId = req.user.userId;
        await bookingService.requestPayment(userId, req.params.bookingId);
        res.status(202).json({ success: true, message: "Payment request received" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getBookingsByUser = async (req, res) => {
    try {
        if (req.params.userId !== req.user.userId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const bookings = await bookingService.getBookingsByUser(req.params.userId);
        res.status(200).json({ success: true, bookings });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
