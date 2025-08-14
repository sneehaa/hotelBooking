const bookingRepo = require('../repositories/bookingRepository');
const hotelRepo = require('../repositories/hotelRepository');
const rabbitmq = require('../utils/rabbitmq');

const BOOKING_EXCHANGE = 'booking_requests_exchange';
const WALLET_EXCHANGE = 'wallet_events_exchange';

class BookingService {
  async searchAvailableHotels(location, startDate, endDate) {
    return await hotelRepo.searchAvailableHotels(location, startDate, endDate);
  }

  async requestBooking(userId, hotelId, roomNumber, startDate, endDate) {
    await rabbitmq.publish(BOOKING_EXCHANGE, 'booking.request', { userId, hotelId, roomNumber, startDate, endDate });
  }

  async requestCancellation(userId, bookingId) {
    await rabbitmq.publish(BOOKING_EXCHANGE, 'booking.cancel', { userId, bookingId });
  }

  async requestPayment(userId, bookingId) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking || booking.user.toString() !== userId) throw new Error('Unauthorized or booking not found');
    if (booking.status !== 'booked') throw new Error('Booking not payable');
    await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.pay', { bookingId, userId });
  }

  async getBookingsByUser(userId) { return await bookingRepo.findByUser(userId); }

  // Event-driven handlers
  async processBookingRequest({ hotelId, roomNumber, userId, startDate, endDate }) {
    const conflict = await bookingRepo.findConflictingBooking(hotelId, roomNumber, startDate, endDate);
    if (conflict) throw new Error('Room already booked');

    const price = await hotelRepo.getRoomPrice(hotelId, roomNumber);
    const booking = await bookingRepo.create({ hotel: hotelId, roomNumber, user: userId, startDate, endDate, status: 'pending' });

    await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.hold', { bookingId: booking._id.toString(), userId, amount: price });
  }

  async confirmHold({ bookingId }) { await bookingRepo.updateStatus(bookingId, 'booked'); }
  async confirmPayment({ bookingId }) { await bookingRepo.updateStatus(bookingId, 'paid'); }

  async cancelBooking({ bookingId, userId }) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking || booking.user.toString() !== userId) throw new Error('Unauthorized or booking not found');
    if (['cancelled', 'paid'].includes(booking.status)) throw new Error('Cannot cancel booking');
    await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.release', { bookingId });
    await bookingRepo.updateStatus(bookingId, 'cancelled');
  }
}

module.exports = new BookingService();
