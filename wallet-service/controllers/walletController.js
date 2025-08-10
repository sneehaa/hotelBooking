const walletService = require("../services/walletServices");

exports.loadMoney = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { amount } = req.body;

    const wallet = await walletService.loadMoney(userId, amount, role);
    res.status(200).json({ success: true, wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const wallet = await walletService.getWallet(userId);
    res.status(200).json({ success: true, wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllWallets = async (req, res) => {
  try {
    // Optionally restrict access to admins only here or via middleware
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admins only" });
    }

    const wallets = await walletService.getAllWallets();
    res.status(200).json({ success: true, wallets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.payForBooking = async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    await walletService.payForBooking(userId, amount, role);
    res.status(200).json({ success: true, message: "Payment successful" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
exports.holdMoney = async (req, res) => {
  try {
    const wallet = await walletService.holdMoney(
      req.user.userId,
      req.body.bookingId, 
      req.body.amount
    );
    res.json({ success: true, wallet });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.releaseHold = async (req, res) => {
  try {
    const wallet = await walletService.releaseHold(
      req.user.userId, // Get from auth token
      req.body.bookingId
    );
    res.json({ success: true, wallet });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.confirmHold = async (req, res) => {
  try {
    const success = await walletService.confirmHold(req.user.id, req.body.bookingId, req.user.role);
    res.json({ success });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};