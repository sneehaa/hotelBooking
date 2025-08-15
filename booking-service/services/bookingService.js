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
                console.error(`Booking with ID: ${bookingId} not found.`);
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
            console.log(`[Booking Service] Funds hold request successful for booking ID: ${bookingId}. Awaiting confirmation.`);
        } catch (err) {
            console.error(`[Booking Service] Async booking failed for ID: ${bookingId}:`, err.response?.data || err.message);
            const walletErrorMessage = err.response?.data?.message || err.message;
            if (booking) {
                await bookingRepo.updateStatus(bookingId, 'failed');
            }
        }
    }

    async getBookingsByUser(userId) { return await bookingRepo.findByUser(userId); }

    async cancelBooking({ bookingId, userId }) {
        const booking = await bookingRepo.findById(bookingId);
        if (!booking || booking.user.toString() !== userId) throw new Error('Unauthorized or booking not found');
        if (['cancelled', 'paid'].includes(booking.status)) throw new Error('Cannot cancel booking');

        await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.release', { bookingId });
        await bookingRepo.updateStatus(bookingId, 'cancelled');
    }

    async confirmHold({ bookingId }) { await bookingRepo.updateStatus(bookingId, 'booked'); }
    async failHold({ bookingId, reason }) { await bookingRepo.updateStatus(bookingId, 'failed'); }
    async confirmPayment({ bookingId }) { await bookingRepo.updateStatus(bookingId, 'paid'); }
}

module.exports = new BookingService();