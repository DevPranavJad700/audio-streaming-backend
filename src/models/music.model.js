const mongoose = require("mongoose");

const musicSchema = new mongoose.Schema(
  {
    uri: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast lookups by artist and title search
musicSchema.index({ artist: 1 });
musicSchema.index({ title: "text" });
musicSchema.index({ createdAt: -1 });

const musicModel = mongoose.model("Music", musicSchema);
module.exports = musicModel;
