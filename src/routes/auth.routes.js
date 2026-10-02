const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { validate } = require("../middlewares/validate.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.middleware");
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require("../validators/auth.validator");
const { paginationValidator, mongoIdParam } = require("../validators/music.validator");
const { authUser } = require("../middlewares/auth.middleware");

// ─── Authentication Endpoints ────────────────────────────────────────────────
router.post(
  "/register",
  authLimiter,
  registerValidator,
  validate,
  authController.registerUser,
);

router.post(
  "/login",
  authLimiter,
  loginValidator,
  validate,
  authController.loginUser,
);

router.post(
  "/refresh",
  authLimiter,
  authController.refreshToken,
);

router.post(
  "/logout",
  authController.logoutUser,
);

router.get(
  "/me",
  authUser,
  authController.getMe,
);

// ─── Password Recovery ───────────────────────────────────────────────────────
router.post(
  "/forgot-password",
  authLimiter,
  forgotPasswordValidator,
  validate,
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  authLimiter,
  resetPasswordValidator,
  validate,
  authController.resetPassword,
);

// ─── Public Profiles & Discovery ─────────────────────────────────────────────
router.get(
  "/artists",
  paginationValidator,
  validate,
  authController.getArtists,
);

router.get(
  "/profile/:userId",
  mongoIdParam("userId"),
  validate,
  authController.getPublicProfile,
);

module.exports = router;
