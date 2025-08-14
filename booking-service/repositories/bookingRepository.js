const Booking = require('../models/bookingModel');
const redisClient = require('../utils/redisClient');

class BookingRepository {
    async create(data) {
        return await new Booking(data).save();
    }

    async findById(id) {
        return await Booking.findById(id);
    }

    async findByUser(userId) {
        const cacheKey = `userBookings:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
        const bookings = await Booking.find({ user: userId });
        await redisClient.setEx(cacheKey, 60, JSON.stringify(bookings));
        return bookings;
    }

    async findConflictingBooking(hotelId, roomNumber, startDate, endDate) {
        return await Booking.findOne({
            hotel: hotelId,
            roomNumber,
            status: { $in: ['booked', 'paid'] },
            startDate: { $lt: new Date(endDate) },
            endDate: { $gt: new Date(startDate) },
        });
    }

    async updateStatus(bookingId, status) {
        return await Booking.findByIdAndUpdate(bookingId, { status }, { new: true });
    }
}

module.exports = new BookingRepository();
