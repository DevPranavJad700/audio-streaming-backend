const express = require("express");
const router = express.Router();
const musicController = require("../controllers/music.controller");
const { authArtist, authUser } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const {
  createMusicValidator,
  createAlbumValidator,
  updateMusicValidator,
  updateAlbumValidator,
  paginationValidator,
  mongoIdParam,
} = require("../validators/music.validator");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/flac"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed (mp3, mp4, wav, ogg, flac)"));
    }
  },
});

const uploadCoverArt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for cover art images
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for cover art (jpeg, png, webp, gif)"));
    }
  },
});

// ─── Albums ──────────────────────────────────────────────────────────────────
router.post(
  "/albums",
  authArtist,
  uploadCoverArt.single("coverArt"),
  createAlbumValidator,
  validate,
  musicController.createAlbum,
);

router.get(
  "/albums",
  authUser,
  paginationValidator,
  validate,
  musicController.getAllAlbums,
);

router.get(
  "/my-albums",
  authArtist,
  paginationValidator,
  validate,
  musicController.getMyAlbums,
);

router.get(
  "/albums/:albumId",
  authUser,
  mongoIdParam("albumId"),
  validate,
  musicController.getAlbumById,
);

router.patch(
  "/albums/:albumId",
  authArtist,
  uploadCoverArt.single("coverArt"),
  mongoIdParam("albumId"),
  updateAlbumValidator,
  validate,
  musicController.updateAlbum,
);

router.delete(
  "/albums/:albumId",
  authArtist,
  mongoIdParam("albumId"),
  validate,
  musicController.deleteAlbum,
);

// ─── Music ───────────────────────────────────────────────────────────────────
router.post(
  "/upload",
  authArtist,
  upload.single("music"),
  createMusicValidator,
  validate,
  musicController.createMusic,
);

router.get(
  "/",
  authUser,
  paginationValidator,
  validate,
  musicController.getAllMusics,
);

router.get(
  "/my-uploads",
  authArtist,
  paginationValidator,
  validate,
  musicController.getMyUploads,
);

router.get(
  "/:musicId",
  authUser,
  mongoIdParam("musicId"),
  validate,
  musicController.getMusicById,
);

router.patch(
  "/:musicId",
  authArtist,
  mongoIdParam("musicId"),
  updateMusicValidator,
  validate,
  musicController.updateMusic,
);

router.delete(
  "/:musicId",
  authArtist,
  mongoIdParam("musicId"),
  validate,
  musicController.deleteMusic,
);

module.exports = router;
