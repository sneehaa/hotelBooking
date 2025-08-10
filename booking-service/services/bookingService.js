const bookingService = require("../services/bookingService");
const Booking = require("../models/bookingModel");
const axios = require("axios");
const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

(async () => {
  await redisClient.connect();
})();

exports.searchAvailableHotels = async (location, startDate, endDate) => {
  if (!location || !startDate || !endDate) {
    throw new Error("location, startDate, and endDate are required");
  }

  const cacheKey = `hotels:${location}:${startDate}:${endDate}`;


const cachedData = await redisClient.get(cacheKey);

if (cachedData) {
  const parsedData = JSON.parse(cachedData);
  if (Array.isArray(parsedData) && parsedData.length > 0) {
    console.log("Serving search results from cache");
    return parsedData;
  } else {
    console.log("Cached data is empty array, ignoring cache");
  }
}

  let results;
  try {
    const response = await axios.get(
      `${process.env.HOTEL_SERVICE_URL}/search`,
      {
        params: { location, startDate, endDate },
      }
    );
    console.log("Hotel service response data:", response.data);
    results = Array.isArray(response.data) ? response.data : (response.data.results || []);
  } catch (error) {
    console.error("Error fetching hotels from hotel-service:", error.message);
    throw new Error("Failed to fetch hotels from hotel-service");
  }
  if (results.length > 0) {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(results));
  } else {
    console.log("Not caching empty search results");
  }

  return results;
};


exports.createBooking = async ({
  hotelId,
  roomNumber,
  userId,
  startDate,
  endDate,
  userToken,
}) => {
  if (!hotelId || !roomNumber || !userId || !startDate || !endDate) {
    throw new Error("All fields are required");
  }

  let hotel;
  try {
    const hotelRes = await axios.get(
      `${process.env.HOTEL_SERVICE_URL}/${hotelId}`
    );
    hotel = hotelRes.data.hotel;
  } catch (error) {
    throw new Error("Failed to fetch hotel data from hotel-service");
  }

  if (!hotel) throw new Error("Hotel not found");

  const room = hotel.rooms.find((r) => r.roomNumber === roomNumber);
  if (!room) throw new Error("Room not found in hotel");

  const requiredAmount = room.price + 5;

  let availableBalance;
  try {
    const walletRes = await axios.get(
      `${process.env.WALLET_SERVICE_URL}/balance`,
      {
        headers: { Authorization: `Bearer ${userToken}` },
      }
    );

    availableBalance = walletRes.data.wallet.balance - 
      (walletRes.data.wallet.holds?.reduce((sum, h) => sum + h.amount, 0) || 0);

  } catch (error) {
    throw new Error("Failed to fetch wallet balance from wallet-service");
  }

  if (availableBalance < requiredAmount) {
    const err = new Error(
      `Insufficient balance. Room costs Rs ${room.price}. You need at least Rs ${requiredAmount}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    throw new Error("Invalid date range: startDate must be before endDate");
  }

  const conflictingBooking = await Booking.findOne({
    hotel: hotelId,
    roomNumber,
    status: "booked",
    startDate: { $lt: end },
    endDate: { $gt: start },
  });

  if (conflictingBooking) {
    const error = new Error("Room already booked for these dates");
    error.statusCode = 409;
    throw error;
  }
  const newBooking = new Booking({
    hotel: hotelId,
    roomNumber,
    user: userId,
    startDate: start,
    endDate: end,
    status: "booked",
  });
  const savedBooking = await newBooking.save();

try {
  await axios.post(
    `${process.env.WALLET_SERVICE_URL}/hold`,
    {
      bookingId: savedBooking._id.toString(),
      amount: room.price,
    },
    {
      headers: { Authorization: `Bearer ${userToken}` },
    }
  );
} catch (err) {
  await Booking.findByIdAndDelete(savedBooking._id);
  throw new Error(
    "Failed to hold money in wallet: " +
      (err.response?.data?.message || err.message)
  );
}


  return savedBooking;
};

exports.cancelBooking = async (bookingId, userId, token) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) throw new Error("Booking not found");
  if (booking.user.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You can only cancel your own bookings");
  }
  if (booking.status === "paid" || booking.status === "cancelled") {
    throw new Error("Booking cannot be cancelled in its current state");
  }

  // Release hold
  try {
    await axios.post(
      `${process.env.WALLET_SERVICE_URL}/release`,
      { bookingId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    throw new Error(
      "Failed to release hold in wallet: " +
        (err.response?.data?.message || err.message)
    );
  }

  booking.status = "cancelled";
  return await booking.save();
};

exports.payForBooking = async (bookingId, userId, token) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) throw new Error("Booking not found");
  if (booking.user.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You can only pay for your own bookings");
  }
  if (booking.status !== "booked") {
    throw new Error("Booking is not in a payable state");
  }

  // Confirm hold & transfer funds
  try {
    await axios.post(
      `${process.env.WALLET_SERVICE_URL}/confirm`,
      { bookingId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    throw new Error(
      "Payment failed: " +
        (err.response?.data?.message || err.message)
    );
  }

  booking.status = "paid";
  return await booking.save();
};

exports.cancelBooking = async (bookingId, userId, token) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error("Booking not found");
    throw error;
  }
  if (booking.user.toString() !== userId.toString()) {
    const error = new Error("Unauthorized: You can only cancel your own bookings");
    throw error;
  }

  if (booking.status === "cancelled") {
    const error = new Error("Booking is already cancelled");
    error.statusCode = 400;
    throw error;
  }

  if (booking.status === "paid") {
    const error = new Error("Paid bookings cannot be cancelled through this endpoint");
    error.statusCode = 400;
    throw error;
  }

  let roomPrice;
  try {
    const hotelResponse = await axios.get(
      `${process.env.HOTEL_SERVICE_URL}/${booking.hotel}`
    );
    const room = hotelResponse.data.hotel.rooms.find(
      r => r.roomNumber === booking.roomNumber
    );
    roomPrice = room?.price;
  } catch (err) {
    console.error("Failed to fetch room price:", err);
  }

  try {
    await axios.post(
      `${process.env.WALLET_SERVICE_URL}/release`,
      { bookingId: booking._id.toString() },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error("Failed to release hold:", err);
  }
  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  const updatedBooking = await booking.save();
  try {
    const cacheKey = `hotels:${booking.hotel}:${booking.startDate}:${booking.endDate}`;
    await redisClient.del(cacheKey);
  } catch (err) {
    console.error("Failed to clear cache:", err);
  }

  return updatedBooking;
};

exports.payForBooking = async (bookingId, userId, token) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  if (booking.user.toString() !== userId.toString()) {
    const error = new Error(
      "Unauthorized: You can only pay for your own bookings"
    );
    error.statusCode = 403;
    throw error;
  }

  if (booking.status !== "booked") {
    const error = new Error("Booking is not in a payable state");
    error.statusCode = 400;
    throw error;
  }

  const hotelId = booking.hotel;
  const roomNumber = booking.roomNumber;

  let roomPrice;
  try {
    const hotelResponse = await axios.get(
      `${process.env.HOTEL_SERVICE_URL}/${hotelId}`
    );
    const hotel = hotelResponse.data.hotel;

    const room = hotel.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) {
      const error = new Error("Room not found in hotel data");
      error.statusCode = 400;
      throw error;
    }

    roomPrice = room.price;
  } catch (err) {
    const error = new Error(
      "Failed to fetch room price: " +
        (err.response?.data?.message || err.message)
    );
    error.statusCode = err.response?.status || 500;
    throw error;
  }

  const totalAmount = roomPrice;
  try {
    const walletResponse = await axios.post(
      `${process.env.WALLET_SERVICE_URL}/pay`,
      { amount: roomPrice },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!walletResponse.data.success) {
      const error = new Error("Payment failed: " + walletResponse.data.message);
      error.statusCode = 400;
      throw error;
    }
  } catch (err) {
    const error = new Error(
      "Payment failed: " + (err.response?.data?.message || err.message)
    );
    error.statusCode = err.response?.status || 500;
    throw error;
  }

  booking.status = "paid";
  return await booking.save();
};

exports.getBookingsByUser = async (userId) => {
  return await Booking.find({ user: userId });
};
