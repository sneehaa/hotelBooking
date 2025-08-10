const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    required: true,
  },
  holds: [
    {
      bookingId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true 
      },
      amount: { 
        type: Number, 
        required: true 
      },
      createdAt: { 
        type: Date, 
        default: Date.now 
      }
    }
  ]
});

module.exports = mongoose.model("Wallet", walletSchema);
