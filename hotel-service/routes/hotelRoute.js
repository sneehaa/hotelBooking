const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const { authGuard, adminGuard } = require('../middleware/authMiddleware');

router.post('/seed', authGuard, adminGuard, hotelController.seedHotels);
router.get('/all', hotelController.getAllHotels);
router.get('/search', hotelController.searchHotels);
router.get('/hotels/:hotelId/rooms/:roomNumber/price', hotelController.getRoomPrice);
router.get('/:id', hotelController.getHotelById);

module.exports = router;
