const express = require("express");
const router = express.Router();
const walletController = require("../controllers/walletController");
const authGuard = require("../middleware/authMiddleware");

router.post("/load", authGuard, walletController.loadMoney);
router.get("/balance", authGuard, walletController.getBalance);
router.get("/all", authGuard, walletController.getAllWallets);
router.post("/pay", authGuard, walletController.payForBooking);

module.exports = router;
