const rabbitmq = require("../utils/rabbitmq");
const bookingService = require("../services/bookingService");

const BOOKING_EXCHANGE = "booking_requests_exchange";
const WALLET_EXCHANGE = "wallet_events_exchange";

exports.setupEventListeners = () => {
  rabbitmq.consume(
    BOOKING_EXCHANGE,
    "booking_request_queue",
    "booking.request",
    bookingService.processBookingRequest.bind(bookingService)
  );
  rabbitmq.consume(
    BOOKING_EXCHANGE,
    "booking_cancel_queue",
    "booking.cancel",
    bookingService.cancelBooking.bind(bookingService)
  );
  rabbitmq.consume(
    WALLET_EXCHANGE,
    "booking_hold_queue",
    "wallet.hold.confirmed",
    bookingService.confirmHold.bind(bookingService)
  );
  rabbitmq.consume(
    WALLET_EXCHANGE,
    "booking_paid_queue",
    "wallet.payment.confirmed",
    bookingService.confirmPayment.bind(bookingService)
  );
};
