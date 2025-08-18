// From hotel-service/listeners/hotelListener.js

const rabbitmq = require("../utils/rabbitmq");
const hotelService = require("../services/hotelService");

const BOOKING_EVENTS_EXCHANGE = "booking_events_exchange";

exports.setupEventListeners = () => {
  console.log("Setting up hotel service event listeners...");

  // Listener for booking creation events
  rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    "hotel.booking.created.queue",
    "booking.created", // Change this to the correct routing key
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

  // Listener for booking cancellation events
  rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    "hotel.booking.cancelled.queue",
    "booking.cancelled", // This is correct based on the logs
    async (msg) => {
      console.log("[HotelListener] Received booking.cancelled event:", msg);
      try {
        await hotelService.handleBookingCancelled(msg);
      } catch (error) {
        console.error(
          "[HotelListener] Error processing booking.cancelled:",
          error
        );
      }
    }
  );
};