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
