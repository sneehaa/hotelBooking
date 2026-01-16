require('dotenv').config();
const rabbitmq = require('./rabbitmq');
const { sendConfirmationEmail } = require('./emailSender');

const BOOKING_EVENTS_EXCHANGE = 'booking_events_exchange';
const ROUTING_KEYS = {
  BOOKING_CREATED_ACK: 'booking.created.acknowledgment',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_PAYMENT_CONFIRMED: 'booking.payment.confirmed',
  BOOKING_CANCELLED: 'booking.cancelled'
};

async function startEmailService() {
  console.log("Starting Email Service...");
  await rabbitmq.connect();

  await rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    'email_booking_created_queue',
    ROUTING_KEYS.BOOKING_CREATED_ACK,
    async (message) => {
      if (message?.userEmail && message?.bookingDetails) {
        await sendConfirmationEmail(message.userEmail, message.bookingDetails, 'booking_acknowledgment');
      }
    }
  );

  await rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    'email_booking_confirmed_queue',
    ROUTING_KEYS.BOOKING_CONFIRMED,
    async (message) => {
      if (message?.userEmail && message?.bookingDetails) {
        await sendConfirmationEmail(message.userEmail, message.bookingDetails, 'booking_confirmed');
      }
    }
  );

  await rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    'email_booking_payment_queue',
    ROUTING_KEYS.BOOKING_PAYMENT_CONFIRMED,
    async (message) => {
      if (message?.userEmail && message?.bookingDetails) {
        await sendConfirmationEmail(message.userEmail, message.bookingDetails, 'booking_payment_confirmed');
      }
    }
  );

  await rabbitmq.consume(
    BOOKING_EVENTS_EXCHANGE,
    'email_booking_cancelled_queue',
    ROUTING_KEYS.BOOKING_CANCELLED,
    async (message) => {
      if (message?.userEmail && message?.bookingDetails) {
        await sendConfirmationEmail(message.userEmail, message.bookingDetails, 'booking_cancelled');
      }
    }
  );
}

startEmailService();
