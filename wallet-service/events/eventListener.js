const rabbitmq = require("../utils/rabbitmq");
const walletService = require("../services/walletServices");
const BOOKING_EXCHANGE = "booking_requests_exchange";
const WALLET_EXCHANGE = "wallet_events_exchange";

exports.setupEventListeners = () => {
  rabbitmq.consume(
    WALLET_EXCHANGE,
    "wallet_hold_request_queue",
    "wallet.hold",
    async (data) => {
      const { userId, bookingId, amount } = data;
      try {
        await walletService.holdMoney(userId, bookingId, amount);
      } catch (err) {
        console.error(
          `[Wallet Listener] Hold failed for bookingId ${bookingId}:`,
          err.message
        );
        await rabbitmq.publish(WALLET_EXCHANGE, "wallet.hold.failed", {
          bookingId,
          userId,
          reason: err.message,
        });
      }
    }
  );

  rabbitmq.consume(
    WALLET_EXCHANGE,
    "wallet_release_request_queue",
    "wallet.release",
    async (data) => {
      const { userId, bookingId } = data;
      try {
        await walletService.releaseHold(userId, bookingId);
      } catch (err) {
        console.error(
          `[Wallet Listener] Release failed for bookingId ${bookingId}:`,
          err.message
        );
      }
    }
  );

  rabbitmq.consume(
  WALLET_EXCHANGE,
  "wallet_payment_request_queue",
  "wallet.payment.request",
  async (data) => {
    try {
      const { bookingId, userId, amount } = data;

      if (!bookingId || !userId || amount == null) {
        throw new Error(
          `Invalid message data. bookingId=${bookingId}, userId=${userId}, amount=${amount}`
        );
      }

      console.log("[Wallet] Processing payment:", { bookingId, userId, amount });

      const userWallet = await walletService.getWallet(userId.toString());
      if (!userWallet) throw new Error(`Wallet not found for user ${userId}`);

      await walletService.confirmHold({
        bookingId: bookingId.toString(),
        userId: userId.toString(),
        amount,
      });

      console.log(`[Wallet] Payment confirmed for bookingId=${bookingId}`);

      await rabbitmq.publish(WALLET_EXCHANGE, "wallet.payment.confirmed", {
        bookingId: bookingId.toString(),
        userId: userId.toString(),
        amount,
      });
    } catch (err) {
      console.error(
        `[Wallet Listener] Payment failed for bookingId=${data?.bookingId || "undefined"}:`,
        err.message
      );

      await rabbitmq.publish(WALLET_EXCHANGE, "wallet.payment.failed", {
        bookingId: data?.bookingId?.toString(),
        userId: data?.userId?.toString(),
        reason: err.message,
      });
    }
  }
);

};