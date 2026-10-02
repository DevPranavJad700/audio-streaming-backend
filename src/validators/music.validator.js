const { body, param, query } = require("express-validator");

const createMusicValidator = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ max: 100 }).withMessage("Title must be at most 100 characters"),
];

const createAlbumValidator = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ max: 100 }).withMessage("Title must be at most 100 characters"),

  body("musics")
    .isArray({ min: 1 }).withMessage("musics must be a non-empty array")
    .custom((arr) => arr.every((id) => /^[a-f\d]{24}$/i.test(id)))
    .withMessage("Each item in musics must be a valid MongoDB ObjectId"),
];

const paginationValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50")
    .toInt(),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("search query too long"),
];

const updateMusicValidator = [
  body("title")
    .optional()
    .trim()
    .notEmpty().withMessage("Title cannot be empty")
    .isLength({ max: 100 }).withMessage("Title must be at most 100 characters"),
];

const updateAlbumValidator = [
  body("title")
    .optional()
    .trim()
    .notEmpty().withMessage("Title cannot be empty")
    .isLength({ max: 100 }).withMessage("Title must be at most 100 characters"),

  body("musics")
    .optional()
    .isArray({ min: 1 }).withMessage("musics must be a non-empty array")
    .custom((arr) => arr.every((id) => /^[a-f\d]{24}$/i.test(id)))
    .withMessage("Each item in musics must be a valid MongoDB ObjectId"),
];

const mongoIdParam = (paramName) => [
  param(paramName)
    .isMongoId().withMessage(`${paramName} must be a valid MongoDB ObjectId`),
];

module.exports = {
  createMusicValidator,
  createAlbumValidator,
  updateMusicValidator,
  updateAlbumValidator,
  paginationValidator,
  mongoIdParam,
};
