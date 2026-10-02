process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_32chars_minimum!!";
process.env.IMAGEKIT_PRIVATE_KEY = "private_test_key";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/rbas_test";

// ── Mock the DB connection so no real MongoDB is needed ───────────────────────
jest.mock("../src/db/db", () => jest.fn().mockResolvedValue(true));

// ── Mock models ───────────────────────────────────────────────────────────────
jest.mock("../src/models/user.model");
jest.mock("../src/models/refreshToken.model");
jest.mock("../src/models/passwordResetToken.model");
jest.mock("../src/models/album.model");
jest.mock("../src/models/music.model");

const request = require("supertest");
const app = require("../src/app");
const userModel = require("../src/models/user.model");
const RefreshToken = require("../src/models/refreshToken.model");
const PasswordResetToken = require("../src/models/passwordResetToken.model");
const albumModel = require("../src/models/album.model");
const musicModel = require("../src/models/music.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ── Helpers ───────────────────────────────────────────────────────────────────
const crypto = require("crypto");

function makeToken(payload = { id: "user123", role: "user" }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function makeRawRefresh() {
  return crypto.randomBytes(40).toString("hex");
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const mockUser = {
  _id: "user123",
  id: "user123",
  username: "johndoe",
  email: "john@example.com",
  password: "",
  role: "user",
};

beforeEach(() => {
  jest.clearAllMocks();
  RefreshToken.create = jest.fn().mockResolvedValue({});
  RefreshToken.findOne = jest.fn().mockResolvedValue(null);
  RefreshToken.deleteOne = jest.fn().mockResolvedValue({});
  RefreshToken.deleteMany = jest.fn().mockResolvedValue({});
  PasswordResetToken.create = jest.fn().mockResolvedValue({});
  PasswordResetToken.findOne = jest.fn().mockResolvedValue(null);
  PasswordResetToken.deleteMany = jest.fn().mockResolvedValue({});
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  const valid = {
    username: "johndoe",
    email: "john@example.com",
    password: "secret123",
  };

  it("registers a new user and returns 201 with tokens", async () => {
    userModel.findOne = jest.fn().mockResolvedValue(null);
    userModel.create = jest.fn().mockResolvedValue({ ...mockUser, role: "user" });

    const res = await request(app).post("/api/auth/register").send(valid);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
    const cookies = res.headers["set-cookie"] || [];
    expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
  });

  it("registers an artist when role=artist is supplied", async () => {
    userModel.findOne = jest.fn().mockResolvedValue(null);
    userModel.create = jest.fn().mockResolvedValue({ ...mockUser, role: "artist" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...valid, role: "artist" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("artist");
  });

  it("returns 409 when username is already taken", async () => {
    userModel.findOne = jest.fn().mockResolvedValue({ ...mockUser });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...valid, email: "other@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/username/i);
  });

  it("returns 409 when email is already taken", async () => {
    userModel.findOne = jest
      .fn()
      .mockResolvedValue({ ...mockUser, username: "different" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...valid, username: "janedoe" });

    expect(res.status).toBe(409);
  });

  it("returns 422 when required fields are missing", async () => {
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it("returns 422 for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...valid, email: "not-an-email" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when password is shorter than 6 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...valid, password: "abc" });
    expect(res.status).toBe(422);
  });

  it("returns 422 for an invalid role value", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...valid, role: "admin" });
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("logs in with valid credentials and returns tokens", async () => {
    const hash = await bcrypt.hash("secret123", 10);
    userModel.findOne = jest.fn().mockResolvedValue({ ...mockUser, password: hash });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "john@example.com", password: "secret123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const cookies = res.headers["set-cookie"] || [];
    expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
  });

  it("returns 401 for wrong password", async () => {
    const hash = await bcrypt.hash("correctpassword", 10);
    userModel.findOne = jest.fn().mockResolvedValue({ ...mockUser, password: hash });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "john@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a non-existent user", async () => {
    userModel.findOne = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "secret123" });

    expect(res.status).toBe(401);
  });

  it("returns 422 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "john@example.com" });
    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
describe("POST /api/auth/refresh", () => {
  it("issues a new access token with a valid refresh token cookie", async () => {
    const raw = makeRawRefresh();
    RefreshToken.findOne = jest.fn().mockResolvedValue({
      _id: "rt1",
      tokenHash: hashToken(raw),
      user: "user123",
      expiresAt: new Date(Date.now() + 60_000),
      deleteOne: jest.fn().mockResolvedValue({}),
    });
    userModel.findById = jest.fn().mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${raw}`]);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("returns 401 when no refresh token cookie is sent", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid / unknown refresh token", async () => {
    RefreshToken.findOne = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", ["refreshToken=badtoken"]);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("returns 200 and deletes the refresh token from DB", async () => {
    const raw = makeRawRefresh();

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [`refreshToken=${raw}`]);

    expect(res.status).toBe(200);
    expect(RefreshToken.deleteOne).toHaveBeenCalled();
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
describe("GET /api/auth/me", () => {
  it("returns user profile for an authenticated user", async () => {
    userModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const token = makeToken({ id: "user123", role: "user" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it("authenticates using Authorization: Bearer <token> header", async () => {
    userModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const token = makeToken({ id: "user123", role: "user" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user no longer exists in DB", async () => {
    userModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const token = makeToken({ id: "user123", role: "user" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
describe("POST /api/auth/forgot-password", () => {
  it("returns 200 and dispatches instructions for an existing user", async () => {
    userModel.findOne = jest.fn().mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "john@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If that email is registered");
    expect(PasswordResetToken.create).toHaveBeenCalled();
  });

  it("returns 200 with identical message for non-existent user (anti-enumeration)", async () => {
    userModel.findOne = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If that email is registered");
    expect(PasswordResetToken.create).not.toHaveBeenCalled();
  });

  it("returns 422 for invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
describe("POST /api/auth/reset-password", () => {
  it("resets password, updates user, and revokes all refresh tokens", async () => {
    const validReset = {
      user: "user123",
      used: false,
      expiresAt: new Date(Date.now() + 60000),
      save: jest.fn().mockResolvedValue(true),
    };
    PasswordResetToken.findOne = jest.fn().mockResolvedValue(validReset);
    userModel.findByIdAndUpdate = jest.fn().mockResolvedValue({});

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(40), newPassword: "newsecret123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Password has been reset successfully");
    expect(userModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ user: "user123" });
  });

  it("returns 400 for an invalid or expired reset token", async () => {
    PasswordResetToken.findOne = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "b".repeat(40), newPassword: "newsecret123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid or expired");
  });

  it("returns 422 when password is shorter than 6 characters", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(40), newPassword: "123" });

    expect(res.status).toBe(422);
  });
});

// ─── GET /api/auth/artists ───────────────────────────────────────────────────
describe("GET /api/auth/artists", () => {
  it("returns 200 with paginated list of artists", async () => {
    userModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockUser]),
    });
    userModel.countDocuments = jest.fn().mockResolvedValue(1);

    const res = await request(app).get("/api/auth/artists?page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.artists).toBeInstanceOf(Array);
    expect(res.body.pagination.total).toBe(1);
  });
});

// ─── GET /api/auth/profile/:userId ───────────────────────────────────────────
describe("GET /api/auth/profile/:userId", () => {
  it("returns 200 with artist stats and albums when user role is artist", async () => {
    const artistUser = {
      _id: "507f1f77bcf86cd799439011",
      username: "artist_jane",
      role: "artist",
      createdAt: new Date(),
    };
    userModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(artistUser),
    });
    albumModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([{ title: "Album 1" }]),
    });
    musicModel.countDocuments = jest.fn().mockResolvedValue(3);

    const res = await request(app).get("/api/auth/profile/507f1f77bcf86cd799439011");

    expect(res.status).toBe(200);
    expect(res.body.profile.stats.totalTracks).toBe(3);
    expect(res.body.profile.stats.totalAlbums).toBe(1);
  });

  it("returns 404 when profile does not exist", async () => {
    userModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).get("/api/auth/profile/507f1f77bcf86cd799439011");
    expect(res.status).toBe(404);
  });

  it("returns 422 for invalid ObjectId format", async () => {
    const res = await request(app).get("/api/auth/profile/invalid-id");
    expect(res.status).toBe(422);
  });
});

// ─── System / Documentation ──────────────────────────────────────────────────
describe("System & Documentation Endpoints", () => {
  it("GET /health returns 200 ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api-docs.json returns OpenAPI 3.0 specification", async () => {
    const res = await request(app).get("/api-docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.0");
    expect(res.body.info.title).toContain("RBAS API");
  });
});

