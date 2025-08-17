
const mongoose = require('mongoose');
const walletRepo = require('../repositories/walletRepository');
const redisClient = require('../utils/redisClient');
const rabbitmq = require('../utils/rabbitmq');

const HOTEL_OWNER_ID = process.env.HOTEL_OWNER_ID;
const WALLET_EXCHANGE = 'wallet_events_exchange';

function toObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid ID format: ${id}`);
    }
    return new mongoose.Types.ObjectId(id);
}

function getOwnerObjectId() {
    if (!HOTEL_OWNER_ID) {
        throw new Error("Hotel owner ID is not configured.");
    }
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

    if (!wallet) {
        wallet = await walletRepo.createWallet({ userId: userObjectId, balance: amount, role });
    } else {
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
    return await walletRepo.getAllWallets();
};


exports.holdMoney = async (userId, bookingId, amount) => {
    const wallet = await walletRepo.findByUserId(toObjectId(userId));
    if (!wallet) throw new Error('Wallet not found');

    const totalHeld = wallet.holds.reduce((sum, h) => sum + h.amount, 0);
    const availableBalance = wallet.balance - totalHeld;

    if (availableBalance < amount) throw new Error('Insufficient balance to hold');

    wallet.holds.push({ bookingId: toObjectId(bookingId), amount });
    await walletRepo.updateWallet(wallet);
    await updateCache(wallet);

    await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.hold.confirmed', { userId, bookingId, amount });
    return wallet;
};


exports.releaseHold = async (userId, bookingId) => {
    const wallet = await walletRepo.findByUserId(toObjectId(userId));
    if (!wallet) throw new Error('Wallet not found');

    const bookingObjectId = toObjectId(bookingId);
    wallet.holds = wallet.holds.filter(h => !h.bookingId.equals(bookingObjectId));
    await walletRepo.updateWallet(wallet);
    await updateCache(wallet);

    await rabbitmq.publish(WALLET_EXCHANGE, 'wallet.hold.released', { userId, bookingId });
    return wallet;
};


exports.confirmHold = async (userId, bookingId, role) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userWallet = await walletRepo.findByUserId(toObjectId(userId), session);
        if (!userWallet) throw new Error('User wallet not found');

        const ownerWalletId = getOwnerObjectId();
        let ownerWallet = await walletRepo.findByUserId(ownerWalletId, session);
        if (!ownerWallet) {
            ownerWallet = await walletRepo.createWallet({ userId: ownerWalletId, balance: 0, role: 'admin' }, session);
        }

        const holdIndex = userWallet.holds.findIndex(h => h.bookingId.equals(toObjectId(bookingId)));
        if (holdIndex === -1) throw new Error('No hold found');

        const hold = userWallet.holds[holdIndex];
        userWallet.balance -= hold.amount;
        userWallet.holds.splice(holdIndex, 1);
        ownerWallet.balance += hold.amount;

        await walletRepo.updateWallet(userWallet, session);
        await walletRepo.updateWallet(ownerWallet, session);

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
