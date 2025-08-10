const mongoose = require("mongoose");
const Wallet = require("../models/walletModel");
const axios = require("axios");


const HOTEL_OWNER_ID = process.env.HOTEL_OWNER_ID;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

if (!HOTEL_OWNER_ID) {
  throw new Error("HOTEL_OWNER_ID environment variable is not set.");
}

function toObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
}

function getOwnerObjectId() {
  return toObjectId(HOTEL_OWNER_ID.trim());
}

async function fetchUserInfo(userId) {
  try {
    const res = await axios.get(`${USER_SERVICE_URL}/users/${userId}`);
    return res.data.user;
  } catch (err) {
    console.error("[WalletService] Failed to fetch user info:", err.message);
    return null;
  }
}

exports.loadMoney = async (userId, amount, role) => {

  if (!amount || amount <= 0) throw new Error("Amount must be a positive number");
  if (!userId) throw new Error("User ID is required");

  const userObjectId = toObjectId(userId);

  let wallet = await Wallet.findOne({ userId: userObjectId });

  if (!wallet) {
    wallet = new Wallet({ userId: userObjectId, balance: amount, role });
  } else {
    wallet.balance += amount;
    if (wallet.role !== role) {
      wallet.role = role;
    }
  }

  const savedWallet = await wallet.save();
  return savedWallet;
};

exports.getWallet = async (userId) => {
  if (!userId) throw new Error("User ID is required");

  const userObjectId = toObjectId(userId);
  const wallet = await Wallet.findOne({ userId: userObjectId });
  if (!wallet) throw new Error("Wallet not found");
  return wallet;
};

exports.getAllWallets = async () => {
  const wallets = await Wallet.find();
  const walletsWithUser = await Promise.all(
    wallets.map(async (wallet) => {
      const userInfo = await fetchUserInfo(wallet.userId.toString());
      return {
        ...wallet.toObject(),
        user: userInfo,
      };
    })
  );

  return walletsWithUser;
};

exports.payForBooking = async (userId, amount, role) => {
  if (!userId) throw new Error("User ID is required");
  if (!amount || amount <= 0) throw new Error("Amount must be a positive number");
  if (!role) throw new Error("Role is required");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userObjectId = toObjectId(userId);
    const ownerObjectId = getOwnerObjectId();

    let userWallet = await Wallet.findOne({ userId: userObjectId }).session(session);
    if (!userWallet) {
      throw new Error("User wallet not found");
    }

    let ownerWallet = await Wallet.findOne({ userId: ownerObjectId }).session(session);
    if (!ownerWallet) {
      ownerWallet = new Wallet({ userId: ownerObjectId, balance: 0, role: "admin" });
    }

    if (userWallet.role !== role) {
      userWallet.role = role;
    }

    if (userWallet.balance < amount) {
      throw new Error("Insufficient balance");
    }

    userWallet.balance -= amount;
    ownerWallet.balance += amount;

    await userWallet.save({ session });
    await ownerWallet.save({ session });

    await session.commitTransaction();
    console.log("[WalletService] Payment successful: user wallet debited, owner wallet credited");

    return true;
  } catch (error) {
    await session.abortTransaction();
    console.error("[WalletService] Transaction aborted due to error:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};


exports.holdMoney = async (userId, bookingId, amount) => {
  console.log(`Attempting to hold money for user ${userId}, booking ${bookingId}, amount ${amount}`);
  if (!userId || !bookingId) throw new Error("User ID and Booking ID are required");
  if (!amount || amount <= 0) throw new Error("Amount must be positive");

  const userObjectId = toObjectId(userId);
  const bookingObjectId = toObjectId(bookingId);

  const wallet = await Wallet.findOne({ userId: userObjectId });
  if (!wallet) throw new Error("Wallet not found");

  const totalHeld = wallet.holds.reduce((sum, h) => sum + h.amount, 0);
  const availableBalance = wallet.balance - totalHeld;

  if (availableBalance < amount) throw new Error("Insufficient available balance to hold");

  wallet.holds.push({ bookingId: bookingObjectId, amount });
  await wallet.save();

  return wallet;
};

exports.releaseHold = async (userId, bookingId) => {
  const userObjectId = toObjectId(userId);
  const bookingObjectId = toObjectId(bookingId);

  const wallet = await Wallet.findOne({ userId: userObjectId });
  if (!wallet) throw new Error("Wallet not found");

  const beforeCount = wallet.holds.length;
  wallet.holds = wallet.holds.filter(h => !h.bookingId.equals(bookingObjectId));

  if (wallet.holds.length === beforeCount) {
    throw new Error("No hold found for given booking");
  }

  await wallet.save();
  return wallet;
};

exports.confirmHold = async (userId, bookingId, role) => {
  const userObjectId = toObjectId(userId);
  const ownerObjectId = getOwnerObjectId();
  const bookingObjectId = toObjectId(bookingId);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let userWallet = await Wallet.findOne({ userId: userObjectId }).session(session);
    let ownerWallet = await Wallet.findOne({ userId: ownerObjectId }).session(session);

    if (!userWallet) throw new Error("User wallet not found");
    if (!ownerWallet) ownerWallet = new Wallet({ userId: ownerObjectId, balance: 0, role: "admin" });

    const hold = userWallet.holds.find(h => h.bookingId.equals(bookingObjectId));
    if (!hold) throw new Error("No hold found for this booking");

    if (userWallet.role !== role) {
      userWallet.role = role;
    }

    // Deduct from user & credit to owner
    userWallet.balance -= hold.amount;
    userWallet.holds = userWallet.holds.filter(h => !h.bookingId.equals(bookingObjectId));

    ownerWallet.balance += hold.amount;

    await userWallet.save({ session });
    await ownerWallet.save({ session });

    await session.commitTransaction();
    return true;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};
