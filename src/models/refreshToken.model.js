const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    // We store the SHA-256 hash of the raw token — never the raw value
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
  },
  { timestamps: true },
);

// MongoDB TTL index — automatically deletes expired documents
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast lookup by user (e.g., logout-all-devices)
refreshTokenSchema.index({ user: 1 });

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
module.exports = RefreshToken;
