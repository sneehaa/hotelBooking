const bookingService = require('../services/bookingService');
const rabbitmq = require('../utils/rabbitmq');
const WALLET_EXCHANGE = 'wallet_events_exchange';
const BOOKING_EXCHANGE = 'booking_requests_exchange';

exports.searchAvailableHotels = async (req, res) => {
    try {
        const { location, startDate, endDate } = req.query;
        console.log(`[Booking Controller] Search request received for location: ${location}, dates: ${startDate} to ${endDate}`);
        const results = await bookingService.searchAvailableHotels(location, startDate, endDate);
        res.status(200).json({ success: true, results });
    } catch (err) {
        console.error("[Booking Controller] Error in searchAvailableHotels:", err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.createBooking = async (req, res) => {
    try {
        const userId = req.user.userId;
        const authToken = req.headers.authorization;
        const { hotelId, roomNumber, startDate, endDate } = req.body;
        console.log(`[Booking Controller] Async booking request received for userId: ${userId}, hotelId: ${hotelId}, room: ${roomNumber}, dates: ${startDate} to ${endDate}`);

        const booking = await bookingService.createPendingBooking({
            userId,
            hotelId,
            roomNumber,
            startDate,
            endDate,
        });

        await rabbitmq.publish(
            BOOKING_EXCHANGE,
            'booking.request',
            { bookingId: booking._id.toString(), userId, authToken }
        );

        console.log(`[Booking Controller] Booking request published to RabbitMQ for booking ID: ${booking._id}`);
        res.status(202).json({ 
            success: true, 
            message: 'Booking request accepted for processing. Check booking status for updates.', 
            bookingId: booking._id 
        });
    } catch (err) {
        console.error("[Booking Controller] Booking creation error:", err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getBookingsByUser = async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log(`[Booking Controller] Get bookings by user request received for userId: ${userId}`);
        if (req.params.userId !== req.user.userId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const bookings = await bookingService.getBookingsByUser(req.params.userId);
        res.status(200).json({ success: true, bookings });
    } catch (err) {
        console.error("[Booking Controller] Error in getBookingsByUser:", err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const userId = req.user.userId;
        const bookingId = req.params.id;

        console.log(`Cancel booking request received: bookingId=${bookingId}, userId=${userId}`);

        await bookingService.cancelBooking({ bookingId, userId });

        console.log(`Cancellation processed: bookingId=${bookingId}. Wallet release triggered.`);
        res.status(202).json({ success: true, message: "Cancellation request accepted for processing" });
    } catch (err) {
        console.error(`Error in cancelBooking: ${err.message}`);
        res.status(400).json({ success: false, message: err.message });
    }
};


exports.payForBooking = async (req, res) => {
    try {
        const userId = req.user.userId;
        const bookingId = req.params.bookingId;
        console.log(`[Booking Controller] Pay for booking request received for bookingId: ${bookingId}, userId: ${userId}`);

        const booking = await bookingService.findById(bookingId);
        if (!booking) {
            console.error(`[Booking Controller] Booking ${bookingId} not found for payment.`);
            return res.status(404).json({ success: false, message: "Booking not found." });
        }
        const amountToPay = booking.price + 5; 
        console.log(`[Booking Controller] Fetching booking ${bookingId} to get payment amount. Amount: ${amountToPay}`);

        await rabbitmq.publish(
            WALLET_EXCHANGE,
            "wallet.payment.request",
            { bookingId, userId, amount: amountToPay }
        );
        console.log(`[Booking Controller] Payment request published to RabbitMQ for bookingId: ${bookingId}`);
        res.status(202).json({ success: true, message: "Payment request sent" });

    } catch (error) {
        console.error("[Booking Controller] Payment request error:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};