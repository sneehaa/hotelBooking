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
};
