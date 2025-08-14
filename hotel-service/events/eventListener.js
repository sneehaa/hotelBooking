const hotelService = require('../services/hotelService');
const rabbitmq = require('../utils/rabbitmq');

const HOTEL_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events_exchange';

exports.setupEventListeners = () => {
  rabbitmq.consume(
    HOTEL_EXCHANGE,
    'booking_hold_queue',
    'booking.hold',
    hotelService.handleBookingRequest.bind(hotelService)
  );

  rabbitmq.consume(
    HOTEL_EXCHANGE,
    'booking_cancel_queue',
    'booking.cancel',
    hotelService.handleBookingCancel.bind(hotelService)
  );
};
