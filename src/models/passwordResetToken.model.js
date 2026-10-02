const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// TTL index — automatically deletes document when expiresAt timestamp is reached
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ user: 1 });

const PasswordResetToken = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema,
);

module.exports = PasswordResetToken;
