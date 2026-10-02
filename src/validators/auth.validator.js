const { body } = require("express-validator");

const registerValidator = [
  body("username")
    .trim()
    .notEmpty().withMessage("Username is required")
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers and underscores"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

  body("role")
    .optional()
    .isIn(["user", "artist"]).withMessage("Role must be 'user' or 'artist'"),
];

const loginValidator = [
  body("password")
    .notEmpty().withMessage("Password is required"),

  body("email")
    .optional()
    .isEmail().withMessage("Must be a valid email")
    .normalizeEmail(),

  body("username")
    .optional()
    .trim(),
];

const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email")
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body("token")
    .trim()
    .notEmpty().withMessage("Reset token is required")
    .isLength({ min: 10 }).withMessage("Invalid reset token format"),

  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};
