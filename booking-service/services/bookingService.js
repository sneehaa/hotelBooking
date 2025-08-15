const bookingRepo = require('../repositories/bookingRepository');
const hotelRepo = require('../repositories/hotelRepository');
const rabbitmq = require('../utils/rabbitmq');
const axios = require('axios');

const BOOKING_EXCHANGE = 'booking_requests_exchange';
const WALLET_EXCHANGE = 'wallet_events_exchange';

class BookingService {
    async searchAvailableHotels(location, startDate, endDate) {
        return await hotelRepo.searchAvailableHotels(location, startDate, endDate);
    }

    async checkRoomAvailability(hotelId, roomNumber, startDate, endDate) {
        const conflict = await bookingRepo.findConflictingBooking(
            hotelId,
            roomNumber,
            startDate,
            endDate
        );
        return !conflict;
    }

    async getRoomPrice(hotelId, roomNumber) {
        try {
            const res = await axios.get(
                `${process.env.HOTEL_SERVICE_URL}/hotels/${hotelId}/rooms/${roomNumber}/price`
            );
            return res.data.price;
        } catch (err) {
            console.error("Error fetching room price:", err.response?.data || err.message);
            throw new Error("Failed to fetch room price from hotel service.");
        }
    }

    async findById(bookingId) {
        return await bookingRepo.findById(bookingId);
    }

    async createPendingBooking({ userId, hotelId, roomNumber, startDate, endDate }) {
        const isAvailable = await this.checkRoomAvailability(hotelId, roomNumber, startDate, endDate);
        if (!isAvailable) {
            throw new Error('Requested room is not available for the specified dates.');
        }

        const price = await this.getRoomPrice(hotelId, roomNumber);
        
        let booking = null;
        try {
            booking = await bookingRepo.create({
                hotel: hotelId,
                roomNumber,
                user: userId,
                startDate,
                endDate,
                price: price,
                status: 'pending'
            });
            console.log(`[Booking Service] Pending booking created with ID: ${booking._id}`);
            return booking;
        } catch (dbError) {
            console.error("Error saving booking to database:", dbError);
            throw new Error("Failed to save booking details to database.");
        }
    }


    async processBookingRequest({ bookingId, userId, authToken }) {
        console.log(`[Booking Service] Processing async booking for ID: ${bookingId}`);
        let booking = null;
        try {
            booking = await bookingRepo.findById(bookingId);
            if (!booking) {
                console.error(`[Booking Service] Booking with ID: ${bookingId} not found during async processing.`);
                return;
            }

            const requiredAmount = booking.price + 5;

            await bookingRepo.updateStatus(bookingId, 'processing');
            console.log(`[Booking Service] Attempting to hold funds for booking ID: ${bookingId} with amount: ${requiredAmount}`);

            await axios.post(
                `${process.env.WALLET_SERVICE_URL}/hold`,
                { bookingId: bookingId, userId, amount: requiredAmount },
                { headers: { Authorization: authToken || process.env.SYSTEM_WALLET_TOKEN } }
            );
            console.log(`[Booking Service] Funds hold request successful for booking ID: ${bookingId}. Awaiting confirmation from Wallet Service.`);
        } catch (err) {
            console.error(`[Booking Service] Async booking failed for ID: ${bookingId}:`, err.response?.data || err.message);
            if (booking) {
                await bookingRepo.updateStatus(bookingId, 'failed');
                console.log(`[Booking Service] Booking ID: ${bookingId} status updated to 'failed' due to error.`);
            }
        }
    }

    async getBookingsByUser(userId) { return await bookingRepo.findByUser(userId); }

  async cancelBooking({ bookingId, userId }) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
        console.warn(`Cancellation failed: Booking ID ${bookingId} not found.`);
        throw new Error('Booking not found');
    }

    if (booking.user.toString() !== userId) {
        console.warn(`Cancellation failed: User ID ${userId} not authorized for booking ID ${bookingId}.`);
        throw new Error('Unauthorized');
    }

    if (['cancelled', 'paid'].includes(booking.status)) {
        console.warn(`Cancellation failed: Booking ID ${bookingId} is already '${booking.status}'.`);
        throw new Error('Cannot cancel booking');
    }

    console.log(`Publishing 'wallet.release' for booking ID: ${bookingId}`);
    await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.release', { bookingId, userId });
    
    await bookingRepo.updateStatus(bookingId, 'cancelled');
    console.log(`Booking ID: ${bookingId} cancelled successfully.`);
}


    async confirmHold({ bookingId }) { 
        console.log(`[Booking Service] Confirming hold for booking ID: ${bookingId}. Setting status to 'booked'.`);
        await bookingRepo.updateStatus(bookingId, 'booked'); 
    }
    
    async failHold({ bookingId, reason }) { 
        console.log(`[Booking Service] Hold failed for booking ID: ${bookingId}. Reason: ${reason}. Setting status to 'failed'.`);
        await bookingRepo.updateStatus(bookingId, 'failed'); 
    }
    
    async confirmPayment({ bookingId }) { 
        console.log(`[Booking Service] Confirming payment for booking ID: ${bookingId}. Setting status to 'paid'.`);
        await bookingRepo.updateStatus(bookingId, 'paid'); 
    }
}

module.exports = new BookingService();