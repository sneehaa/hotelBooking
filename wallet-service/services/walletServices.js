const mongoose = require('mongoose');
const walletRepo = require('../repositories/walletRepository');
const redisClient = require('../utils/redisClient');
const rabbitmq = require('../utils/rabbitmq');

const HOTEL_OWNER_ID = process.env.HOTEL_OWNER_ID;

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function getOwnerObjectId() {
  return toObjectId(HOTEL_OWNER_ID.trim());
}

async function updateCache(wallet) {
  if (!wallet) return;
  await redisClient.setEx(`wallet:${wallet.userId}`, 300, JSON.stringify(wallet));
}

async function getFromCache(userId) {
  const cached = await redisClient.get(`wallet:${userId}`);
  return cached ? JSON.parse(cached) : null;
}

exports.loadMoney = async (userId, amount, role) => {
  const userObjectId = toObjectId(userId);
  let wallet = await walletRepo.findByUserId(userObjectId);

  if (!wallet) wallet = await walletRepo.createWallet({ userId: userObjectId, balance: amount, role });
  else {
    wallet.balance += amount;
    wallet.role = role;
    await walletRepo.updateWallet(wallet);
  }

  await updateCache(wallet);
  return wallet;
};

exports.getWallet = async (userId) => {
  const cached = await getFromCache(userId);
  if (cached) return cached;

  const wallet = await walletRepo.findByUserId(toObjectId(userId));
  if (!wallet) throw new Error('Wallet not found');
  await updateCache(wallet);
  return wallet;
};

exports.getAllWallets = async () => {
  const wallets = await walletRepo.getAllWallets();
  return wallets;
};

exports.payForBooking = async (userId, amount, role) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userObjectId = toObjectId(userId);
    const ownerObjectId = getOwnerObjectId();

    let userWallet = await walletRepo.findByUserId(userObjectId).session(session);
    if (!userWallet) throw new Error('User wallet not found');

    let ownerWallet = await walletRepo.findByUserId(ownerObjectId).session(session);
    if (!ownerWallet) ownerWallet = await walletRepo.createWallet({ userId: ownerObjectId, balance: 0, role: 'admin' });

    if (userWallet.balance < amount) throw new Error('Insufficient balance');

    userWallet.balance -= amount;
    ownerWallet.balance += amount;

    await walletRepo.updateWallet(userWallet);
    await walletRepo.updateWallet(ownerWallet);

    await updateCache(userWallet);
    await updateCache(ownerWallet);

    await session.commitTransaction();

    // Publish payment event
    await rabbitmq.publish('wallet_events_exchange', 'booking.paid.confirmed', { userId, amount });

    return true;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// Hold money
exports.holdMoney = async (userId, bookingId, amount) => {
  const userObjectId = toObjectId(userId);
  const wallet = await walletRepo.findByUserId(userObjectId);
  if (!wallet) throw new Error('Wallet not found');

  const totalHeld = wallet.holds.reduce((sum, h) => sum + h.amount, 0);
  const availableBalance = wallet.balance - totalHeld;
  if (availableBalance < amount) throw new Error('Insufficient available balance');

  wallet.holds.push({ bookingId: toObjectId(bookingId), amount });
  await walletRepo.updateWallet(wallet);
  await updateCache(wallet);

  // Publish hold confirmation event
  await rabbitmq.publish('wallet_events_exchange', 'booking.hold.confirmed', { userId, bookingId, amount });

  return wallet;
};

exports.releaseHold = async (userId, bookingId) => {
  const userObjectId = toObjectId(userId);
  const wallet = await walletRepo.findByUserId(userObjectId);
  if (!wallet) throw new Error('Wallet not found');

  wallet.holds = wallet.holds.filter(h => !h.bookingId.equals(toObjectId(bookingId)));
  await walletRepo.updateWallet(wallet);
  await updateCache(wallet);
  return wallet;
};

exports.confirmHold = async (userId, bookingId, role) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userObjectId = toObjectId(userId);
    const ownerObjectId = getOwnerObjectId();

    let userWallet = await walletRepo.findByUserId(userObjectId).session(session);
    let ownerWallet = await walletRepo.findByUserId(ownerObjectId).session(session);
    if (!ownerWallet) ownerWallet = await walletRepo.createWallet({ userId: ownerObjectId, balance: 0, role: 'admin' });

    const hold = userWallet.holds.find(h => h.bookingId.equals(toObjectId(bookingId)));
    if (!hold) throw new Error('No hold found');

    userWallet.balance -= hold.amount;
    userWallet.holds = userWallet.holds.filter(h => !h.bookingId.equals(toObjectId(bookingId)));
    ownerWallet.balance += hold.amount;

    await walletRepo.updateWallet(userWallet);
    await walletRepo.updateWallet(ownerWallet);
    await updateCache(userWallet);
    await updateCache(ownerWallet);

    await session.commitTransaction();
    return true;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// Event listener setup
exports.setupEventListeners = () => {
  rabbitmq.consume(
    'booking_requests_exchange',
    'booking_request_queue',
    'booking.request',
    async (data) => {
      const { userId, amount } = data;
      try { await exports.holdMoney(userId, data.bookingId, amount); } 
      catch (err) { console.error(err); }
    }
  );

  rabbitmq.consume(
    'booking_requests_exchange',
    'booking_cancel_queue',
    'booking.cancel',
    async (data) => {
      try { await exports.releaseHold(data.userId, data.bookingId); } 
      catch (err) { console.error(err); }
    }
  );
};
