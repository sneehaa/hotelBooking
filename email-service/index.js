// src/index.js
require('dotenv').config();
const { consume } = require('./utils/rabbitmq');
const { sendConfirmationEmail } = require('./utils/emailSender');

const EXCHANGE_NAME = 'booking_events_exchange';
const QUEUE_NAME = 'email_confirmation_queue';
const ROUTING_KEY = 'booking.completed';

async function startService() {
    console.log("Starting email service...");
    await consume(EXCHANGE_NAME, QUEUE_NAME, ROUTING_KEY, async (message) => {
        if (!message || !message.userEmail || !message.bookingDetails) {
            console.error("Invalid message format received. Skipping.");
            return;
        }
        await sendConfirmationEmail(message.userEmail, message.bookingDetails);
    });
}

startService();