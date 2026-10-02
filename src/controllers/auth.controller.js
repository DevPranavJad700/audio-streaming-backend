const crypto = require("crypto");
const userModel = require("../models/user.model");
const RefreshToken = require("../models/refreshToken.model");
const PasswordResetToken = require("../models/passwordResetToken.model");
const albumModel = require("../models/album.model");
const musicModel = require("../models/music.model");
const { sendPasswordResetEmail } = require("../services/email.service");
const { getPagination } = require("../utils/pagination");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const ACCESS_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

async function issueTokenPair(user, res) {
  // Access token — short-lived JWT
  const accessToken = generateAccessToken(user);

  // Refresh token — cryptographically random opaque value
  const rawRefresh = crypto.randomBytes(40).toString("hex");
  const refreshHash = hashToken(rawRefresh);

  await RefreshToken.create({
    tokenHash: refreshHash,
    user: user._id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  res.cookie("token", accessToken, ACCESS_COOKIE);
  res.cookie("refreshToken", rawRefresh, REFRESH_COOKIE);

  return { accessToken, rawRefresh };
}

function clearAuthCookies(res) {
  res.clearCookie("token", ACCESS_COOKIE);
  res.clearCookie("refreshToken", REFRESH_COOKIE);
}

function safeUser(user) {
  return { id: user._id, username: user.username, email: user.email, role: user.role };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

// POST /api/auth/register
async function registerUser(req, res) {
  try {
    const { username, email, password, role = "user" } = req.body;

    const existing = await userModel.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      const field = existing.username === username ? "Username" : "Email";
      return res.status(409).json({ message: `${field} is already taken` });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.create({ username, email, password: hash, role });

    const { accessToken } = await issueTokenPair(user, res);

    logger.info(`User registered: ${user.email}`);
    return res.status(201).json({
      message: "User registered successfully",
      token: accessToken,
      user: safeUser(user),
    });
  } catch (error) {
    logger.error("registerUser error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// POST /api/auth/login
async function loginUser(req, res) {
  try {
    const { username, email, password } = req.body;

    const user = await userModel.findOne({ $or: [{ username }, { email }] });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { accessToken } = await issueTokenPair(user, res);

    logger.info(`User logged in: ${user.email}`);
    return res.status(200).json({
      message: "Logged in successfully",
      token: accessToken,
      user: safeUser(user),
    });
  } catch (error) {
    logger.error("loginUser error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// POST /api/auth/refresh
async function refreshToken(req, res) {
  try {
    const rawRefresh = req.cookies.refreshToken;
    if (!rawRefresh) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const tokenHash = hashToken(rawRefresh);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (!stored || stored.expiresAt < new Date()) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Token rotation — delete the used token immediately
    await RefreshToken.deleteOne({ _id: stored._id });

    const user = await userModel.findById(stored.user);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "User no longer exists" });
    }

    const { accessToken } = await issueTokenPair(user, res);

    logger.info(`Token refreshed for user: ${user.email}`);
    return res.status(200).json({
      message: "Token refreshed successfully",
      token: accessToken,
    });
  } catch (error) {
    logger.error("refreshToken error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// POST /api/auth/logout
async function logoutUser(req, res) {
  try {
    const rawRefresh = req.cookies.refreshToken;
    if (rawRefresh) {
      await RefreshToken.deleteOne({ tokenHash: hashToken(rawRefresh) });
    }
    clearAuthCookies(res);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("logoutUser error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/auth/me  [authUser]
async function getMe(req, res) {
  try {
    const user = await userModel.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ message: "Profile fetched successfully", user });
  } catch (error) {
    logger.error("getMe error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });
    // Anti-enumeration: Return 200 whether email exists or not
    if (!user) {
      return res.status(200).json({
        message: "If that email is registered, you will receive a password reset link shortly.",
      });
    }

    // Invalidate existing unused tokens for this user
    await PasswordResetToken.deleteMany({ user: user._id });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await PasswordResetToken.create({
      tokenHash,
      user: user._id,
      expiresAt,
    });

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetToken: rawToken,
      resetUrl,
    });

    const response = {
      message: "If that email is registered, you will receive a password reset link shortly.",
    };

    if (process.env.NODE_ENV === "test") {
      response.resetToken = rawToken;
    }

    return res.status(200).json(response);
  } catch (error) {
    logger.error("forgotPassword error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    const tokenHash = hashToken(token);
    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired password reset token" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await userModel.findByIdAndUpdate(resetRecord.user, { password: hash });

    // Mark reset token used
    resetRecord.used = true;
    await resetRecord.save();

    // Revoke all existing sessions / refresh tokens
    await RefreshToken.deleteMany({ user: resetRecord.user });
    clearAuthCookies(res);

    logger.info(`Password successfully reset for user ${resetRecord.user}`);
    return res.status(200).json({
      message: "Password has been reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    logger.error("resetPassword error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/auth/profile/:userId
async function getPublicProfile(req, res) {
  try {
    const user = await userModel.findById(req.params.userId).select("username role createdAt");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData = {
      id: user._id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    };

    if (user.role === "artist") {
      const [albums, trackCount] = await Promise.all([
        albumModel.find({ artist: user._id }).select("title coverArt createdAt"),
        musicModel.countDocuments({ artist: user._id }),
      ]);
      profileData.stats = {
        totalAlbums: albums.length,
        totalTracks: trackCount,
      };
      profileData.albums = albums;
    }

    return res.status(200).json({
      message: "Profile fetched successfully",
      profile: profileData,
    });
  } catch (error) {
    logger.error("getPublicProfile error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// GET /api/auth/artists
async function getArtists(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const search = req.query.search?.trim();

    const filter = { role: "artist" };
    if (search) {
      filter.username = { $regex: search, $options: "i" };
    }

    const [artists, total] = await Promise.all([
      userModel
        .find(filter)
        .select("username createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      userModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "Artists fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      artists,
    });
  } catch (error) {
    logger.error("getArtists error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
  getPublicProfile,
  getArtists,
};
