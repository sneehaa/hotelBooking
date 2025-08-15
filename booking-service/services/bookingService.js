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

    async _handleBookingCreation({ userId, hotelId, roomNumber, startDate, endDate, authToken }) {
        const isAvailable = await this.checkRoomAvailability(hotelId, roomNumber, startDate, endDate);
        if (!isAvailable) throw new Error('Requested room is not available for the specified dates.');

        const price = await this.getRoomPrice(hotelId, roomNumber);
        const requiredAmount = price + 5;

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
            console.log(`[Booking Service] Pending booking created in DB with ID: ${booking._id}`);
        } catch (dbError) {
            console.error("Error saving booking to database:", dbError);
            throw new Error("Failed to save booking details to database.");
        }

        try {
            console.log(`[Booking Service] Attempting to hold funds for booking ID: ${booking._id.toString()} with amount: ${requiredAmount}`);
            await axios.post(
                `${process.env.WALLET_SERVICE_URL}/hold`,
                { bookingId: booking._id.toString(), userId, amount: requiredAmount },
                { headers: { Authorization: authToken || process.env.SYSTEM_WALLET_TOKEN } }
            );
            console.log(`[Booking Service] Funds held successfully for booking ID: ${booking._id}`);
            
            booking = await bookingRepo.updateStatus(booking._id, 'booked');
            return booking;

        } catch (walletError) {
            console.error("Error holding funds:", walletError.response?.data || walletError.message);
            const walletErrorMessage = walletError.response?.data?.message || walletError.message;

            if (booking) {
                await bookingRepo.updateStatus(booking._id, 'failed');
            }
            throw new Error(`Payment processing failed: ${walletErrorMessage}`);
        }
    }

    async createBooking(userId, hotelId, roomNumber, startDate, endDate, authToken) {
        return await this._handleBookingCreation({ userId, hotelId, roomNumber, startDate, endDate, authToken });
    }

    async processBookingRequest({ userId, hotelId, roomNumber, startDate, endDate, authToken }) {
        console.log("Processing async booking request...");
        try {
            const booking = await this._handleBookingCreation({
                userId,
                hotelId,
                roomNumber,
                startDate,
                endDate,
                authToken: authToken
            });
            console.log(`Async booking completed: ${booking._id}`);
        } catch (err) {
            console.error("Async booking failed:", err.message);
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
