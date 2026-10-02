const mongoose = require("mongoose");

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    musics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Music",
      },
    ],
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coverArt: {
      type: String,
      default: null,
    },
    coverArtFileId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

albumSchema.index({ artist: 1 });
albumSchema.index({ title: "text" });
albumSchema.index({ createdAt: -1 });

const albumModel = mongoose.model("Album", albumSchema);
module.exports = albumModel;
