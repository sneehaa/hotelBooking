const hotelService = require("../services/hotelService");
const rabbitmq = require("../utils/rabbitmq");

const BOOKING_EXCHANGE = "booking_requests_exchange"; 

exports.setupEventListeners = () => {
  rabbitmq.consume(
    BOOKING_EXCHANGE,
    "hotel_booking_request_queue",
    "booking.request",
    async (msg) => {
      const { hotelId, roomNumber } = msg;
      await hotelService.markRoomAvailability(hotelId, roomNumber, false);
      console.log(`Room ${roomNumber} at hotel ${hotelId} marked unavailable`);
    }
  );

  rabbitmq.consume(
    BOOKING_EXCHANGE,
    "hotel_booking_cancel_queue",
    "booking.cancel",
    async (msg) => {
      const { hotelId, roomNumber } = msg;
      await hotelService.markRoomAvailability(hotelId, roomNumber, true);
      console.log(`Room ${roomNumber} at hotel ${hotelId} marked available`);
    }
  );

  const walletService = require("../services/walletServices");
const rabbitmq = require("../utils/rabbitmq");

const WALLET_EXCHANGE = 'wallet_events_exchange';

exports.setupEventListeners = () => {

  // Hold money
  rabbitmq.consume(
    WALLET_EXCHANGE,
    "wallet_hold_request_queue",
    "wallet.hold",
    async (data) => {
      const { userId, bookingId, amount } = data;
      try {
        await walletService.holdMoney(userId, bookingId, amount);
      } catch (err) {
        console.error(`[Wallet Listener] Hold failed for bookingId ${bookingId}:`, err.message);
        await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.hold.failed', { bookingId, userId, reason: err.message });
      }
    }
  );

  rabbitmq.consume(
    WALLET_EXCHANGE,
    "wallet_release_request_queue",
    "wallet.release",
    async (data) => {
      const { userId, bookingId } = data;
      try {
        await walletService.releaseHold(userId, bookingId);
      } catch (err) {
        console.error(`[Wallet Listener] Release failed for bookingId ${bookingId}:`, err.message);
      }
    }
  );

 
  rabbitmq.consume(
    WALLET_EXCHANGE,
    "wallet_payment_request_queue",
    "wallet.payment.request",
    async (data) => {
      const { bookingId, userId, amount } = data;
      try {
        const userWallet = await walletService.getWallet(userId);
        const role = userWallet ? userWallet.role : 'user';

        await walletService.confirmHold(userId, bookingId, role);
        await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.payment.confirmed', { userId, bookingId, amount });
      } catch (err) {
        console.error(`[Wallet Listener] Payment failed for bookingId ${bookingId}:`, err.message);
        await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.payment.failed', { bookingId, userId, reason: err.message });
      }
    }
  );
};

};
