const rabbitmq = require("../utils/rabbitmq");
const hotelService = require("../services/hotelService");

const BOOKING_EVENTS_EXCHANGE = "booking_events_exchange";

exports.setupEventListeners = () => {
  rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    "hotel.booking.created.queue",
    "booking.created", 
    async (msg) => {
      console.log("[HotelListener] Received booking.created event:", msg);
      try {
        await hotelService.handleBookingCreated(msg);
      } catch (error) {
        console.error(
          "[HotelListener] Error processing booking.created:",
          error
        );
      }
    }
  );

  rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    "hotel.booking.cancelled.queue",
    "booking.cancelled", 
    async (msg) => {
      console.log("[HotelListener] Received booking.cancelled event:", msg);
      try {
        await hotelService.handleBookingCancel(msg);
      } catch (error) {
        console.error(
          "[HotelListener] Error processing booking.cancelled:",
          error
        );
      }
    }
  );
};