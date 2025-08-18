// src/utils/emailSender.js
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendConfirmationEmail(email, bookingDetails) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Booking Confirmed: ${bookingDetails.hotelName}`,
        html: `
            <h1>Hello, ${bookingDetails.userName}!</h1>
            <p>Your booking for ${bookingDetails.hotelName} has been confirmed. </p>
            <p><b>Booking ID:</b> ${bookingDetails.bookingId}</p>
            <p><b>Check-in:</b> ${bookingDetails.startDate}</p>
            <p><b>Check-out:</b> ${bookingDetails.endDate}</p>
            <p>Thank you for choosing us!</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent to ${email}`);
    } catch (error) {
        console.error("Error sending email:", error.message);
    }
}

module.exports = { sendConfirmationEmail };