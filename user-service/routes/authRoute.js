const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.handleSignup);
router.post('/login', authController.handleLogin);
router.get('/users/:id', authController.handleGetUser);

module.exports = router;