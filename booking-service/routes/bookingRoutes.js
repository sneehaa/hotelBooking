const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authGuard = require('../middleware/authMiddleware');

router.get('/search', bookingController.searchAvailableHotels);
router.post('/book', authGuard, bookingController.createBooking);
router.post('/pay/:bookingId', authGuard, bookingController.payForBooking);
router.get('/user/:userId', authGuard, bookingController.getBookingsByUser);

module.exports = router;
