
const router = require('express').Router();
const userController = require("../controllers/authController");

router.post('/register', userController.signup)
router.post('/login', userController.login)
router.get('/users/:id', userController.getUserById);
  
module.exports = router;