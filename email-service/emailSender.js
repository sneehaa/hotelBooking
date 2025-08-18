const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


function formatDate(date) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

function getEmailContent(templateType, bookingDetails) {
  console.log(`Generating email content for template: ${templateType}`);
  console.log("Booking details:", bookingDetails);

  const userName =
    bookingDetails.userName || bookingDetails.userEmail || "Guest";
  const startDate = formatDate(bookingDetails.startDate);
  const endDate = formatDate(bookingDetails.endDate);

  switch (templateType) {
    case "booking_acknowledgment":
      return {
        subject: `Booking Request Received: ${bookingDetails.hotelName}`,
        html: `
                    <h1>Hello, ${userName}!</h1>
                    <p>Your booking request for <b>${bookingDetails.hotelName}</b> 
                    from <b>${startDate}</b> to <b>${endDate}</b> has been received and is being processed.</p>
                    <p>We'll notify you once it's confirmed. <b>Booking ID:</b> ${bookingDetails.bookingId}</p>
                    <p>Thank you for choosing us!</p>
                `,
      };
    case "booking_confirmed":
      return {
        subject: `Booking Confirmed: ${bookingDetails.hotelName}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="color: #2c3e50; margin: 0;">Booking Confirmed!</h1>
        </div>
        
        <div style="padding: 20px;">
          <p style="font-size: 16px;">Hello ${userName},</p>
          <p style="font-size: 16px;">Your booking at <strong>${
            bookingDetails.hotelName
          }</strong> has been successfully confirmed. We're looking forward to your stay!</p>
          
          <div style="background-color: #f8f9fa; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h2 style="color: #2c3e50; margin-top: 0;">Booking Details</h2>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 5px 0; width: 120px;"><strong>Booking ID:</strong></td>
                <td style="padding: 5px 0;">${bookingDetails.bookingId}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Check-in:</strong></td>
                <td style="padding: 5px 0;">${startDate}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Check-out:</strong></td>
                <td style="padding: 5px 0;">${endDate}</td>
              </tr>
              ${
                bookingDetails.roomNumber
                  ? `
              <tr>
                <td style="padding: 5px 0;"><strong>Room:</strong></td>
                <td style="padding: 5px 0;">${bookingDetails.roomNumber}</td>
              </tr>
              `
                  : ""
              }
              <tr>
                <td style="padding: 5px 0;"><strong>Total Price:</strong></td>
                <td style="padding: 5px 0;">NPR ${bookingDetails.price}</td>
              </tr>
            </table>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #2c3e50;">What's Next?</h3>
            <ul style="padding-left: 20px;">
             
              <li>Present this confirmation at the front desk when you arrive</li>
              <li>Contact us if you have any special requests</li>
            </ul>
          </div>
          
          
          <p style="font-size: 16px;">Thank you for choosing us! We're committed to making your stay comfortable and memorable.</p>
          
          <p style="font-size: 16px;">Safe travels,<br>
          <strong>The ${bookingDetails.hotelName} Team</strong></p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e9ecef;">
          <p style="margin: 0;">© ${new Date().getFullYear()} ${
          bookingDetails.hotelName
        }. All rights reserved.</p>
        </div>
      </div>
    `,
      };
    case "booking_cancelled":
      return {
        subject: `Booking Cancellation Confirmation: ${bookingDetails.hotelName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #d9534f;">Booking Cancellation</h1>
                
                <p>Dear ${bookingDetails.userName},</p>
                
                <p>Your booking has been successfully cancelled. Here are the details:</p>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Cancellation Details</h3>
                    <p><strong>Booking ID:</strong> ${
                      bookingDetails.bookingId
                    }</p>
                    <p><strong>Hotel:</strong> ${bookingDetails.hotelName}</p>
                    ${
                      bookingDetails.roomNumber
                        ? `<p><strong>Room:</strong> ${bookingDetails.roomNumber}</p>`
                        : ""
                    }
                    <p><strong>Dates:</strong> ${formatDate(
                      bookingDetails.startDate
                    )} to ${formatDate(bookingDetails.endDate)}</p>
                    <p><strong>Original Price:</strong> NPR ${
                      bookingDetails.price
                    }</p>
                    <p><strong>Cancellation Date:</strong> ${formatDate(
                      bookingDetails.cancellationDate
                    )}</p>
                </div>
                
                <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Refund Information</h3>
                    <p>If your booking was paid, any applicable refund will be processed within 5-7 business days.</p>
                    <p>You'll receive a separate email confirmation once the refund is processed.</p>
                </div>
                
                <p>We're sorry to see you go. If this cancellation was made by mistake or you need any assistance, 
                please contact our customer support.</p>
                
                <p>Thank you,<br>
                <strong>The Booking Team</strong></p>
            </div>
        `,
      };
    case "booking_payment_confirmed":
      return {
        subject: `Payment Confirmed for Booking at ${bookingDetails.hotelName}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <h1 style="color: #28a745; margin: 0;">Payment Successful!</h1>
        </div>
        
        <div style="padding: 20px;">
          <p style="font-size: 16px;">Hello ${userName},</p>
          <p style="font-size: 16px;">We've successfully processed your payment for your stay at <strong>${
            bookingDetails.hotelName
          }</strong>.</p>
          
          <div style="background-color: #f8f9fa; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <h2 style="color: #2c3e50; margin-top: 0;">Payment Details</h2>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 5px 0; width: 120px;"><strong>Booking ID:</strong></td>
                <td style="padding: 5px 0;">${bookingDetails.bookingId}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Amount Paid:</strong></td>
                <td style="padding: 5px 0; color: #28a745; font-weight: bold;">NPR ${
                  bookingDetails.price
                }</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Payment Date:</strong></td>
                <td style="padding: 5px 0;">${formatDate(new Date())}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Payment Method:</strong></td>
                <td style="padding: 5px 0;">${
                  bookingDetails.paymentMethod || "Online Payment"
                }</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #e8f4fd; border-left: 4px solid #3498db; padding: 10px 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;">Your payment receipt has been generated and is attached to this email for your records.</p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #2c3e50;">Booking Summary</h3>
            <ul style="padding-left: 20px;">
              <li><strong>Hotel:</strong> ${bookingDetails.hotelName}</li>
              <li><strong>Check-in:</strong> ${startDate}</li>
              <li><strong>Check-out:</strong> ${endDate}</li>
              ${
                bookingDetails.roomNumber
                  ? `<li><strong>Room:</strong> ${bookingDetails.roomNumber}</li>`
                  : ""
              }
            </ul>
          </div>
          
          <p style="font-size: 16px;">Thank you for your payment. Your booking is now fully confirmed and we're preparing for your arrival!</p>
          
          <p style="font-size: 16px;">If you have any questions about your booking, please don't hesitate to contact us.</p>
          
          <p style="font-size: 16px;">Best regards,<br>
          <strong>The ${bookingDetails.hotelName} Team</strong></p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e9ecef;">
          <p style="margin: 0;">© ${new Date().getFullYear()} ${
          bookingDetails.hotelName
        }. All rights reserved.</p>
          <p style="margin: 5px 0 0 0;">This is an automated message - please do not reply directly to this email.</p>
        </div>
      </div>
    `,
      };
    default:
      return {
        subject: "Notification from Booking Service",
        html: "<p>A notification from the booking service.</p>",
      };
  }
}

async function sendConfirmationEmail(userEmail, bookingDetails, templateType) {
  console.log(`Attempting to send email to: ${userEmail}`);

  const { subject, html } = getEmailContent(templateType, bookingDetails);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully!`);
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } catch (error) {
    console.error(
      `Error sending ${templateType} email to ${userEmail}:`,
      error
    );
  }
}

module.exports = { sendConfirmationEmail };
