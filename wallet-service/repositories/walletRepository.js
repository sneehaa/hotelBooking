const Wallet = require("../models/walletModel");

exports.findByUserId = async (userId) => Wallet.findOne({ userId });
exports.createWallet = async (walletData) => new Wallet(walletData).save();
exports.updateWallet = async (wallet) => wallet.save();
exports.getAllWallets = async () => Wallet.find();
