const walletService = require('../services/walletServices');

exports.loadMoney = async (req, res) => {
  try {
    const wallet = await walletService.loadMoney(req.user.userId, req.body.amount, req.user.role);
    res.json({ success: true, wallet });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.getBalance = async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.user.userId);
    res.json({ success: true, wallet });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.payForBooking = async (req, res) => {
  try {
    await walletService.payForBooking(req.user.userId, req.body.amount, req.user.role);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.holdMoney = async (req, res) => {
  try {
    const wallet = await walletService.holdMoney(req.user.userId, req.body.bookingId, req.body.amount);
    res.json({ success: true, wallet });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.releaseHold = async (req, res) => {
  try {
    const wallet = await walletService.releaseHold(req.user.userId, req.body.bookingId);
    res.json({ success: true, wallet });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.getAllWallets = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admins only" });
    }
    const wallets = await walletService.getAllWallets();
    res.json({ success: true, wallets });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.confirmHold = async (req, res) => {
  try {
    const success = await walletService.confirmHold(req.user.userId, req.body.bookingId, req.user.role);
    res.json({ success });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
