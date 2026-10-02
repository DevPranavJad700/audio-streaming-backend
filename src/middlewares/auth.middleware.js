const jwt = require("jsonwebtoken");

/**
 * Extracts JWT token from httpOnly cookie or Authorization Bearer header
 * @param {import("express").Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  const authHeader = req.headers && req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

async function authArtist(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "artist") {
      return res.status(403).json({
        message: "You are not authorized to perform this action",
      });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
}

async function authUser(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "user" && decoded.role !== "artist") {
      return res.status(403).json({
        message: "You are not authorized to perform this action",
      });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
}

module.exports = { authArtist, authUser, extractToken };
