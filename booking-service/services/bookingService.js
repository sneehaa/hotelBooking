const bookingRepo = require("../repositories/bookingRepository");
const hotelRepo = require("../repositories/hotelRepository");
const rabbitmq = require("../utils/rabbitmq");
const redisClient = require("../utils/redisClient");
const axios = require("axios");

const BOOKING_REQUEST_EXCHANGE = "booking_requests_exchange";
const WALLET_EXCHANGE = "wallet_events_exchange";
const BOOKING_EVENTS_EXCHANGE = "booking_events_exchange";

class BookingService {

  async searchAvailableHotels(location) {
  const key = `hotels:search:${location.toLowerCase()}`;
  let hotels = await redisClient.get(key);
  
  if (hotels) {
    return JSON.parse(hotels);
  } else {
    const { data } = await axios.get(
      `${process.env.HOTEL_SERVICE_URL}/search`,
      { params: { location } }
    );
    hotels = Array.isArray(data) ? data : data.results || [];
    if (hotels.length) {
      await redisClient.setEx(key, 300, JSON.stringify(hotels));
    }
    return hotels;
  }

}


  async checkRoomAvailability(hotelId, roomNumber, startDate, endDate) {
    const conflict = await bookingRepo.findConflictingBooking(
      hotelId,
      roomNumber,
      startDate,
      endDate
    );
    return !conflict;
  }

  async getRoomPrice(hotelId, roomNumber) {
    try {
      const res = await axios.get(
        `${process.env.HOTEL_SERVICE_URL}/hotels/${hotelId}/rooms/${roomNumber}/price`,
        { timeout: 5000 }
      );
      return res.data.price;
    } catch (err) {
      console.error(
        "Error fetching room price:",
        err.response?.data || err.message
      );
      throw new Error("Failed to fetch room price from hotel service.");
    }
  }

  async findById(bookingId) {
    return await bookingRepo.findById(bookingId);
  }

  async getUserDetails(userId) {
    if (!userId) {
      throw new Error("Invalid userId provided to getUserDetails");
    }

    try {
      const res = await axios.get(
        `${process.env.USER_SERVICE_URL}/users/${userId}`,
        { timeout: 5000 }
      );

      if (!res.data || !res.data.user || !res.data.user.email) {
        console.error(
          `[Booking Service] User data incomplete for userId ${userId}:`,
          res.data
        );
        throw new Error(`User with ID ${userId} not found or missing email`);
      }

      return {
        userEmail: res.data.user.email,
        userName: res.data.user.name || "Valued Customer",
      };
    } catch (err) {
      if (err.response && err.response.status === 404) {
        throw new Error(`User with ID ${userId} not found`);
      } else if (err.code === "ECONNREFUSED") {
        throw new Error("User Service unreachable");
      } else {
        throw new Error("Failed to fetch user details");
      }
    }
  }

  async getHotelDetails(hotelId) {
    try {
      const res = await axios.get(
        `${process.env.HOTEL_SERVICE_URL}/${hotelId}`,
        { timeout: 5000 }
      );
      return {
        hotelName: res.data.name || "Unknown Hotel",
      };
    } catch (err) {
      return { hotelName: "Unknown Hotel" };
    }
  }

  async validateBookingDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) throw new Error("Invalid start date format");
    if (isNaN(end.getTime())) throw new Error("Invalid end date format");
    if (start >= end) throw new Error("End date must be after start date");

    return true;
  }

  async createPendingBooking({
    userId,
    hotelId,
    roomNumber,
    startDate,
    endDate,
  }) {
    try {
      await this.validateBookingDates(startDate, endDate);

      const isAvailable = await this.checkRoomAvailability(
        hotelId,
        roomNumber,
        startDate,
        endDate
      );
      if (!isAvailable) throw new Error("Requested room is not available");

      const price = await this.getRoomPrice(hotelId, roomNumber);

      const booking = await bookingRepo.create({
        hotel: hotelId,
        roomNumber,
        user: userId,
        startDate,
        endDate,
        price,
        status: "pending",
      });

      console.log(
        `[BookingService] Publishing booking.created event for hotel ${hotelId}, room ${roomNumber}`
      );

      await rabbitmq.publish(BOOKING_EVENTS_EXCHANGE, "booking.created", {
        bookingId: booking._id.toString(),
        hotelId: booking.hotel.toString(),
        roomNumber: booking.roomNumber,
        startDate: booking.startDate,
        endDate: booking.endDate,
        userId,
        action: "create",
      });

      const [userDetails, hotelDetails] = await Promise.all([
        this.getUserDetails(userId),
        this.getHotelDetails(booking.hotel.toString()),
      ]);

      await rabbitmq.publish(
        BOOKING_EVENTS_EXCHANGE,
        "booking.created.acknowledgment",
        {
          bookingId: booking._id.toString(),
          userEmail: userDetails.userEmail,
          bookingDetails: {
            bookingId: booking._id.toString(),
            userEmail: userDetails.userEmail,
            userName: userDetails.userName,
            hotelName: hotelDetails.hotelName,
            startDate: booking.startDate,
            endDate: booking.endDate,
            price: booking.price,
          },
        }
      );

      return booking;
    } catch (err) {
      console.error("[BookingService] Error in createPendingBooking:", err);
      throw err;
    }
  }

  async processBookingRequest({ bookingId, userId, authToken }) {
    let booking = null;
    try {
      booking = await bookingRepo.findById(bookingId);
      if (!booking) return;

      const requiredAmount = booking.price;

      await bookingRepo.updateStatus(bookingId, "processing");

      await axios.post(
        `${process.env.WALLET_SERVICE_URL}/hold`,
        { bookingId, userId, amount: requiredAmount },
        {
          headers: {
            Authorization: authToken || process.env.SYSTEM_WALLET_TOKEN,
          },
        }
      );
    } catch (err) {
      if (booking) await bookingRepo.updateStatus(bookingId, "failed");
    }
  }

  async getBookingsByUser(userId) {
    return await bookingRepo.findByUser(userId);
  }

  async cancelBooking({ bookingId, userId }) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    if (booking.user.toString() !== userId) throw new Error("Unauthorized");
    if (["cancelled", "paid"].includes(booking.status))
      throw new Error("Cannot cancel booking");

    await rabbitmq.publish(WALLET_EXCHANGE, "wallet.release", {
      bookingId,
      userId,
    });
    await bookingRepo.updateStatus(bookingId, "cancelled");

    const [userDetails, hotelDetails] = await Promise.all([
      this.getUserDetails(userId),
      this.getHotelDetails(booking.hotel.toString()),
    ]);

    await rabbitmq.publish(BOOKING_EVENTS_EXCHANGE, "booking.cancelled", {
      bookingId: booking._id.toString(),
      userEmail: userDetails.userEmail,
      userName: userDetails.userName,
      hotelName: hotelDetails.hotelName,
      roomNumber: booking.roomNumber,
      startDate: booking.startDate,
      endDate: booking.endDate,
      price: booking.price,
      status: "cancelled",
      cancellationDate: new Date().toISOString(),
    });
  }

  async confirmHold({ bookingId }) {
    await bookingRepo.updateStatus(bookingId, "booked");
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) return;

    const [userDetails, hotelDetails] = await Promise.all([
      this.getUserDetails(booking.user.toString()),
      this.getHotelDetails(booking.hotel.toString()),
    ]);

    await rabbitmq.publish(BOOKING_EVENTS_EXCHANGE, "booking.confirmed", {
      bookingId: booking._id.toString(),
      userEmail: userDetails.userEmail,
      bookingDetails: {
        bookingId: booking._id.toString(),
        userEmail: userDetails.userEmail,
        userName: userDetails.userName,
        hotelName: hotelDetails.hotelName,
        roomNumber: booking.roomNumber,
        startDate: booking.startDate,
        endDate: booking.endDate,
        price: booking.price,
        status: "booked",
      },
    });
  }

  async confirmPayment({ bookingId, userId, amount }) {
    await bookingRepo.updateStatus(bookingId, "paid");
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) return;

    const [userDetails, hotelDetails] = await Promise.all([
      this.getUserDetails(userId),
      this.getHotelDetails(booking.hotel.toString()),
    ]);

    // publishing event for email service
    await rabbitmq.publish(
      BOOKING_EVENTS_EXCHANGE,
      "booking.payment.confirmed",
      {
        bookingId: booking._id.toString(),
        userEmail: userDetails.userEmail,
        bookingDetails: {
          bookingId: booking._id.toString(),
          hotelName: hotelDetails.hotelName,
          startDate: booking.startDate,
          endDate: booking.endDate,
          price: booking.price,
          userName: userDetails.userName,
          paymentMethod: "Wallet Payment",
        },
      }
    );
  }
}

const bookingService = new BookingService();
module.exports = bookingService;
