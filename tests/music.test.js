process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_32chars_minimum!!";
process.env.IMAGEKIT_PRIVATE_KEY = "private_test_key";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/rbas_test";

jest.mock("../src/db/db", () => jest.fn().mockResolvedValue(true));
jest.mock("../src/services/storage.service", () => ({
  uploadFile: jest.fn().mockResolvedValue({ url: "https://ik.imagekit.io/test/music.mp3", fileId: "file123" }),
  deleteFile: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/music.model");
jest.mock("../src/models/album.model");
jest.mock("../src/models/refreshToken.model");
jest.mock("../src/models/user.model");

const request = require("supertest");
const app = require("../src/app");
const storageService = require("../src/services/storage.service");
const musicModel = require("../src/models/music.model");
const albumModel = require("../src/models/album.model");
const RefreshToken = require("../src/models/refreshToken.model");
const jwt = require("jsonwebtoken");

// ── IDs ───────────────────────────────────────────────────────────────────────
const ARTIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const USER_ID   = "bbbbbbbbbbbbbbbbbbbbbbbb";
const ALBUM_ID  = "cccccccccccccccccccccccc";
const MUSIC_ID  = "dddddddddddddddddddddddd";

// ── Token helpers ─────────────────────────────────────────────────────────────
function artistToken() {
  return jwt.sign({ id: ARTIST_ID, role: "artist" }, process.env.JWT_SECRET, { expiresIn: "15m" });
}
function userToken() {
  return jwt.sign({ id: USER_ID, role: "user" }, process.env.JWT_SECRET, { expiresIn: "15m" });
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const mockMusic = {
  _id: MUSIC_ID,
  id: MUSIC_ID,
  title: "Test Song",
  uri: "https://ik.imagekit.io/test/music.mp3",
  artist: ARTIST_ID,
  createdAt: new Date().toISOString(),
  deleteOne: jest.fn().mockResolvedValue({}),
};

const mockAlbum = {
  _id: ALBUM_ID,
  id: ALBUM_ID,
  title: "Test Album",
  musics: [MUSIC_ID],
  artist: { toString: () => ARTIST_ID },
  createdAt: new Date().toISOString(),
  deleteOne: jest.fn().mockResolvedValue({}),
};

beforeEach(() => {
  jest.clearAllMocks();
  RefreshToken.create = jest.fn().mockResolvedValue({});
  RefreshToken.findOne = jest.fn().mockResolvedValue(null);
  RefreshToken.deleteOne = jest.fn().mockResolvedValue({});
  musicModel.countDocuments = jest.fn().mockResolvedValue(1);
});

// ─── GET /api/music ──────────────────────────────────────────────────────────
describe("GET /api/music", () => {
  beforeEach(() => {
    musicModel.find = jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([mockMusic]),
    });
    musicModel.countDocuments = jest.fn().mockResolvedValue(1);
  });

  it("returns 200 with paginated music for an authenticated user", async () => {
    const res = await request(app)
      .get("/api/music")
      .set("Cookie", [`token=${userToken()}`]);

    expect(res.status).toBe(200);
    expect(res.body.musics).toBeInstanceOf(Array);
    expect(res.body.pagination).toHaveProperty("total", 1);
    expect(res.body.pagination).toHaveProperty("hasNextPage");
  });

  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(app).get("/api/music");
    expect(res.status).toBe(401);
  });

  it("calls find with $regex when ?search= is provided", async () => {
    await request(app)
      .get("/api/music?search=piano")
      .set("Cookie", [`token=${userToken()}`]);

    expect(musicModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.objectContaining({ $regex: "piano" }) }),
    );
  });

  it("returns 422 for invalid pagination params", async () => {
    const res = await request(app)
      .get("/api/music?page=0")
      .set("Cookie", [`token=${userToken()}`]);
    expect(res.status).toBe(422);
  });
});

// ─── GET /api/music/:musicId ─────────────────────────────────────────────────
describe("GET /api/music/:musicId", () => {
  it("returns 200 with music details", async () => {
    musicModel.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockMusic),
    });

    const res = await request(app)
      .get(`/api/music/${MUSIC_ID}`)
      .set("Cookie", [`token=${userToken()}`]);

    expect(res.status).toBe(200);
    expect(res.body.music.title).toBe("Test Song");
  });

  it("returns 404 for a non-existent music ID", async () => {
    musicModel.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .get(`/api/music/${MUSIC_ID}`)
      .set("Cookie", [`token=${userToken()}`]);

    expect(res.status).toBe(404);
  });

  it("returns 422 for an invalid MongoDB ID format", async () => {
    const res = await request(app)
      .get("/api/music/not-a-valid-id")
      .set("Cookie", [`token=${userToken()}`]);
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/music/albums ──────────────────────────────────────────────────
describe("POST /api/music/albums", () => {
  it("creates an album for an artist and returns 201", async () => {
    const created = { ...mockAlbum, populate: jest.fn().mockResolvedValue(mockAlbum) };
    albumModel.create = jest.fn().mockResolvedValue(created);

    const res = await request(app)
      .post("/api/music/albums")
      .set("Cookie", [`token=${artistToken()}`])
      .send({ title: "My Album", musics: [MUSIC_ID] });

    expect(res.status).toBe(201);
    expect(res.body.album).toBeDefined();
  });

  it("returns 400 when one or more tracks in musics do not belong to the artist", async () => {
    musicModel.countDocuments = jest.fn().mockResolvedValue(0);

    const res = await request(app)
      .post("/api/music/albums")
      .set("Cookie", [`token=${artistToken()}`])
      .send({ title: "Bad Ownership Album", musics: [MUSIC_ID] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("must exist and belong to you");
  });

  it("returns 403 when a regular user tries to create an album", async () => {
    const res = await request(app)
      .post("/api/music/albums")
      .set("Cookie", [`token=${userToken()}`])
      .send({ title: "Hacker Album", musics: [MUSIC_ID] });

    expect(res.status).toBe(403);
  });

  it("returns 422 when title is missing", async () => {
    const res = await request(app)
      .post("/api/music/albums")
      .set("Cookie", [`token=${artistToken()}`])
      .send({ musics: [MUSIC_ID] });

    expect(res.status).toBe(422);
  });

  it("returns 422 when musics contains an invalid ObjectId", async () => {
    const res = await request(app)
      .post("/api/music/albums")
      .set("Cookie", [`token=${artistToken()}`])
      .send({ title: "Bad Album", musics: ["not-an-id"] });

    expect(res.status).toBe(422);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/music/albums")
      .send({ title: "Test", musics: [MUSIC_ID] });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/music/albums ───────────────────────────────────────────────────
describe("GET /api/music/albums", () => {
  beforeEach(() => {
    albumModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([mockAlbum]),
    });
    albumModel.countDocuments = jest.fn().mockResolvedValue(1);
  });

  it("returns 200 with album list for an authenticated user", async () => {
    const res = await request(app)
      .get("/api/music/albums")
      .set("Cookie", [`token=${userToken()}`]);

    expect(res.status).toBe(200);
    expect(res.body.albums).toBeInstanceOf(Array);
    expect(res.body.pagination.total).toBe(1);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(app).get("/api/music/albums");
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/music/albums/:albumId ──────────────────────────────────────────
describe("GET /api/music/albums/:albumId", () => {
  it("returns 200 with full album details", async () => {
    albumModel.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAlbum),
      }),
    });

    const res = await request(app)
      .get(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${userToken()}`]);

    expect(res.status).toBe(200);
    expect(res.body.album.title).toBe("Test Album");
  });

  it("returns 404 for a non-existent album", async () => {
    albumModel.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      }),
    });

    const res = await request(app)
      .get(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${userToken()}`]);

    expect(res.status).toBe(404);
  });

  it("returns 422 for an invalid album ID format", async () => {
    const res = await request(app)
      .get("/api/music/albums/bad-id")
      .set("Cookie", [`token=${userToken()}`]);
    expect(res.status).toBe(422);
  });
});

// ─── PATCH /api/music/albums/:albumId ────────────────────────────────────────
describe("PATCH /api/music/albums/:albumId", () => {
  it("updates album title for the owner and returns 200", async () => {
    albumModel.findById = jest.fn().mockResolvedValue(mockAlbum);
    albumModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({ ...mockAlbum, title: "Updated Title" }),
      }),
    });

    const res = await request(app)
      .patch(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${artistToken()}`])
      .send({ title: "Updated Title" });

    expect(res.status).toBe(200);
    expect(res.body.album.title).toBe("Updated Title");
  });

  it("returns 403 when a non-owner tries to update", async () => {
    albumModel.findById = jest.fn().mockResolvedValue({
      ...mockAlbum,
      artist: { toString: () => "eeeeeeeeeeeeeeeeeeeeeeee" }, // different owner
    });

    const res = await request(app)
      .patch(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${artistToken()}`])
      .send({ title: "Stolen" });

    expect(res.status).toBe(403);
  });

  it("returns 404 when album does not exist", async () => {
    albumModel.findById = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${artistToken()}`])
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/music/albums/:albumId ───────────────────────────────────────
describe("DELETE /api/music/albums/:albumId", () => {
  it("deletes album for the owner and returns 200", async () => {
    albumModel.findById = jest.fn().mockResolvedValue(mockAlbum);

    const res = await request(app)
      .delete(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(200);
    expect(mockAlbum.deleteOne).toHaveBeenCalled();
  });

  it("deletes cover art from storage when album has coverArtFileId", async () => {
    const albumWithCover = {
      ...mockAlbum,
      coverArtFileId: "cover123",
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    albumModel.findById = jest.fn().mockResolvedValue(albumWithCover);

    const res = await request(app)
      .delete(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(200);
    expect(storageService.deleteFile).toHaveBeenCalledWith("cover123");
  });

  it("returns 403 when a non-owner tries to delete", async () => {
    albumModel.findById = jest.fn().mockResolvedValue({
      ...mockAlbum,
      artist: { toString: () => "eeeeeeeeeeeeeeeeeeeeeeee" },
    });

    const res = await request(app)
      .delete(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent album", async () => {
    albumModel.findById = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/music/albums/${ALBUM_ID}`)
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/music/my-albums ────────────────────────────────────────────────
describe("GET /api/music/my-albums", () => {
  it("returns albums scoped to the requesting artist", async () => {
    albumModel.find = jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([mockAlbum]),
    });
    albumModel.countDocuments = jest.fn().mockResolvedValue(1);

    const res = await request(app)
      .get("/api/music/my-albums")
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(200);
    expect(albumModel.find).toHaveBeenCalledWith({ artist: ARTIST_ID });
  });

  it("returns 403 for a regular user", async () => {
    const res = await request(app)
      .get("/api/music/my-albums")
      .set("Cookie", [`token=${userToken()}`]);

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/music/upload ──────────────────────────────────────────────────
describe("POST /api/music/upload", () => {
  it("uploads an audio track and stores fileId", async () => {
    musicModel.create = jest.fn().mockResolvedValue({
      _id: MUSIC_ID,
      title: "Audio Track",
      uri: "https://ik.imagekit.io/test/music.mp3",
      artist: ARTIST_ID,
      fileId: "file123",
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/music/upload")
      .set("Cookie", [`token=${artistToken()}`])
      .field("title", "Audio Track")
      .attach("music", Buffer.from("fake-audio-bytes"), {
        filename: "track.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(201);
    expect(res.body.music).toBeDefined();
    expect(musicModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "file123" }),
    );
  });

  it("returns 403 when regular user attempts to upload", async () => {
    const res = await request(app)
      .post("/api/music/upload")
      .set("Cookie", [`token=${userToken()}`])
      .field("title", "Hack Track")
      .attach("music", Buffer.from("fake-audio-bytes"), {
        filename: "track.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(403);
  });

  it("returns 400 when music file is omitted", async () => {
    const res = await request(app)
      .post("/api/music/upload")
      .set("Cookie", [`token=${artistToken()}`])
      .send({ title: "No File Song" });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/music/:musicId ──────────────────────────────────────────────
describe("DELETE /api/music/:musicId", () => {
  it("deletes music and removes audio from ImageKit when fileId exists", async () => {
    const musicToDelete = {
      _id: MUSIC_ID,
      artist: { toString: () => ARTIST_ID },
      fileId: "audio_file_123",
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    musicModel.findById = jest.fn().mockResolvedValue(musicToDelete);
    albumModel.updateMany = jest.fn().mockResolvedValue({});

    const res = await request(app)
      .delete(`/api/music/${MUSIC_ID}`)
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(200);
    expect(musicToDelete.deleteOne).toHaveBeenCalled();
    expect(storageService.deleteFile).toHaveBeenCalledWith("audio_file_123");
    expect(albumModel.updateMany).toHaveBeenCalled();
  });

  it("returns 403 when non-owner artist attempts to delete", async () => {
    const musicToDelete = {
      _id: MUSIC_ID,
      artist: { toString: () => "other_artist_id" },
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    musicModel.findById = jest.fn().mockResolvedValue(musicToDelete);

    const res = await request(app)
      .delete(`/api/music/${MUSIC_ID}`)
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(403);
  });

  it("returns 404 when music not found", async () => {
    musicModel.findById = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/music/${MUSIC_ID}`)
      .set("Cookie", [`token=${artistToken()}`]);

    expect(res.status).toBe(404);
  });
});

// ─── Dual Auth Header Support ────────────────────────────────────────────────
describe("Dual Auth Header Support on Music Routes", () => {
  it("authenticates artist using Authorization: Bearer header", async () => {
    musicModel.find = jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([mockMusic]),
    });
    musicModel.countDocuments = jest.fn().mockResolvedValue(1);

    const res = await request(app)
      .get("/api/music/my-uploads")
      .set("Authorization", `Bearer ${artistToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.musics).toBeInstanceOf(Array);
  });
});

