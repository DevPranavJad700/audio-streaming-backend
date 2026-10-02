const musicModel = require("../models/music.model");
const albumModel = require("../models/album.model");
const { uploadFile, deleteFile } = require("../services/storage.service");
const { getPagination } = require("../utils/pagination");
const logger = require("../utils/logger");

// ─── Music ──────────────────────────────────────────────────────────────────

// POST /api/music/upload  [authArtist]
async function createMusic(req, res) {
  try {
    const { title } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Music file is required" });
    }

    const result = await uploadFile(file.buffer.toString("base64"));

    const music = await musicModel.create({
      uri: result.url,
      title,
      artist: req.user.id,
      fileId: result.fileId || null,
    });

    return res.status(201).json({
      message: "Music uploaded successfully",
      music: {
        id: music._id,
        title: music.title,
        uri: music.uri,
        artist: music.artist,
        createdAt: music.createdAt,
      },
    });
  } catch (error) {
    logger.error("createMusic error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/music?page=1&limit=10&search=title  [authUser]
async function getAllMusics(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const search = req.query.search?.trim();

    const filter = search
      ? { title: { $regex: search, $options: "i" } }
      : {};

    const [musics, total] = await Promise.all([
      musicModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("artist", "username email"),
      musicModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "Music fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      musics,
    });
  } catch (error) {
    logger.error("getAllMusics error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/music/:musicId  [authUser]
async function getMusicById(req, res) {
  try {
    const music = await musicModel
      .findById(req.params.musicId)
      .populate("artist", "username email");

    if (!music) {
      return res.status(404).json({ message: "Music not found" });
    }

    return res.status(200).json({ message: "Music fetched successfully", music });
  } catch (error) {
    logger.error("getMusicById error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/music/my-uploads  [authArtist]
async function getMyUploads(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [musics, total] = await Promise.all([
      musicModel
        .find({ artist: req.user.id })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      musicModel.countDocuments({ artist: req.user.id }),
    ]);

    return res.status(200).json({
      message: "Your uploads fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      musics,
    });
  } catch (error) {
    logger.error("getMyUploads error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// DELETE /api/music/:musicId  [authArtist]
async function deleteMusic(req, res) {
  try {
    const music = await musicModel.findById(req.params.musicId);

    if (!music) {
      return res.status(404).json({ message: "Music not found" });
    }

    if (music.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own music" });
    }

    if (music.fileId) {
      await deleteFile(music.fileId);
    }

    await music.deleteOne();

    // Also remove this music from any albums
    await albumModel.updateMany(
      { musics: music._id },
      { $pull: { musics: music._id } },
    );

    return res.status(200).json({ message: "Music deleted successfully" });
  } catch (error) {
    logger.error("deleteMusic error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// ─── Albums ─────────────────────────────────────────────────────────────────

// POST /api/music/albums  [authArtist]
async function createAlbum(req, res) {
  try {
    const { title, musics } = req.body;

    if (musics && musics.length > 0) {
      const ownedCount = await musicModel.countDocuments({
        _id: { $in: musics },
        artist: req.user.id,
      });
      if (ownedCount !== musics.length) {
        return res.status(400).json({
          message: "All tracks in an album must exist and belong to you",
        });
      }
    }

    let coverArt = null;
    let coverArtFileId = null;

    if (req.file) {
      const result = await uploadFile(req.file.buffer.toString("base64"), {
        folder: "cover-art",
        fileNamePrefix: "album_cover",
      });
      coverArt = result.url;
      coverArtFileId = result.fileId;
    }

    const album = await albumModel.create({
      title,
      musics,
      artist: req.user.id,
      coverArt,
      coverArtFileId,
    });

    const populated = await album.populate("musics", "title uri");

    return res.status(201).json({
      message: "Album created successfully",
      album: {
        id: populated._id,
        title: populated.title,
        musics: populated.musics,
        artist: populated.artist,
        coverArt: populated.coverArt,
        createdAt: populated.createdAt,
      },
    });
  } catch (error) {
    logger.error("createAlbum error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/music/albums?page=1&limit=10&search=title  [authUser]
async function getAllAlbums(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const search = req.query.search?.trim();

    const filter = search
      ? { title: { $regex: search, $options: "i" } }
      : {};

    const [albums, total] = await Promise.all([
      albumModel
        .find(filter)
        .select("title artist createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("artist", "username email"),
      albumModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "Albums fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      albums,
    });
  } catch (error) {
    logger.error("getAllAlbums error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/music/albums/:albumId  [authUser]
async function getAlbumById(req, res) {
  try {
    const album = await albumModel
      .findById(req.params.albumId)
      .populate("artist", "username email")
      .populate("musics", "title uri createdAt");

    if (!album) {
      return res.status(404).json({ message: "Album not found" });
    }

    return res.status(200).json({ message: "Album fetched successfully", album });
  } catch (error) {
    logger.error("getAlbumById error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/music/my-albums  [authArtist]
async function getMyAlbums(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [albums, total] = await Promise.all([
      albumModel
        .find({ artist: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("musics", "title uri"),
      albumModel.countDocuments({ artist: req.user.id }),
    ]);

    return res.status(200).json({
      message: "Your albums fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      albums,
    });
  } catch (error) {
    logger.error("getMyAlbums error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// DELETE /api/music/albums/:albumId  [authArtist]
async function deleteAlbum(req, res) {
  try {
    const album = await albumModel.findById(req.params.albumId);

    if (!album) {
      return res.status(404).json({ message: "Album not found" });
    }

    if (album.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own albums" });
    }

    if (album.coverArtFileId) {
      await deleteFile(album.coverArtFileId);
    }

    await album.deleteOne();

    return res.status(200).json({ message: "Album deleted successfully" });
  } catch (error) {
    logger.error("deleteAlbum error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// PATCH /api/music/:musicId  [authArtist]
async function updateMusic(req, res) {
  try {
    const music = await musicModel.findById(req.params.musicId);

    if (!music) {
      return res.status(404).json({ message: "Music not found" });
    }
    if (music.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own music" });
    }

    const { title } = req.body;

    // Only update fields that were actually sent
    const updates = {};
    if (title !== undefined) updates.title = title;

    const updated = await musicModel
      .findByIdAndUpdate(req.params.musicId, { $set: updates }, { new: true, runValidators: true })
      .populate("artist", "username email");

    return res.status(200).json({
      message: "Music updated successfully",
      music: updated,
    });
  } catch (error) {
    logger.error("updateMusic error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// PATCH /api/music/albums/:albumId  [authArtist]
async function updateAlbum(req, res) {
  try {
    const album = await albumModel.findById(req.params.albumId);

    if (!album) {
      return res.status(404).json({ message: "Album not found" });
    }
    if (album.artist.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own albums" });
    }

    const { title, musics } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (musics !== undefined) {
      if (musics.length > 0) {
        const ownedCount = await musicModel.countDocuments({
          _id: { $in: musics },
          artist: req.user.id,
        });
        if (ownedCount !== musics.length) {
          return res.status(400).json({
            message: "All tracks in an album must exist and belong to you",
          });
        }
      }
      updates.musics = musics;
    }

    if (req.file) {
      if (album.coverArtFileId) {
        await deleteFile(album.coverArtFileId);
      }
      const result = await uploadFile(req.file.buffer.toString("base64"), {
        folder: "cover-art",
        fileNamePrefix: "album_cover",
      });
      updates.coverArt = result.url;
      updates.coverArtFileId = result.fileId;
    }

    const updated = await albumModel
      .findByIdAndUpdate(req.params.albumId, { $set: updates }, { new: true, runValidators: true })
      .populate("artist", "username email")
      .populate("musics", "title uri");

    return res.status(200).json({
      message: "Album updated successfully",
      album: updated,
    });
  } catch (error) {
    logger.error("updateAlbum error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  createMusic,
  getAllMusics,
  getMusicById,
  getMyUploads,
  updateMusic,
  deleteMusic,
  createAlbum,
  getAllAlbums,
  getAlbumById,
  getMyAlbums,
  updateAlbum,
  deleteAlbum,
};
