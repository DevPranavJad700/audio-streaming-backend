const { validationResult } = require("express-validator");

/**
 * Middleware to read express-validator results and short-circuit with 422
 * if any rule failed. Place this AFTER your validator arrays in the route.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

module.exports = { validate };
