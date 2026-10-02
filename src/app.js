const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./docs/swagger");
const { globalLimiter } = require("./middlewares/rateLimiter.middleware");
const logger = require("./utils/logger");

const authRoutes = require("./routes/auth.routes");
const musicRoutes = require("./routes/music.routes");

const app = express();

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── Security & CORS ─────────────────────────────────────────────────────────
// Configure helmet to permit Swagger UI assets
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// Multi-origin CORS whitelist support (comma-separated or single)
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
    },
    credentials: true,
  }),
);

// ─── Global Rate Limiter ─────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Request Logging ─────────────────────────────────────────────────────────
const isTest = process.env.NODE_ENV === "test";
if (!isTest) {
  app.use(morgan("combined", { stream: logger.stream }));
}

// ─── Body Parsing & Cookies ──────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── NoSQL Injection Sanitization ────────────────────────────────────────────
// In-place sanitization compatible with Express 5 read-only req.query getter
app.use((req, res, next) => {
  ["body", "params", "headers", "query"].forEach((key) => {
    if (req[key]) {
      mongoSanitize.sanitize(req[key], { replaceWith: "_" });
    }
  });
  next();
});

// ─── Interactive API Documentation ───────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/api-docs.json", (req, res) => res.json(swaggerDocument));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error("Unhandled error in request pipeline:", err);

  // Multer file limits & type errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File too large. Please upload a smaller file." });
  }
  if (err.message && (err.message.includes("Only audio files") || err.message.includes("Only image files"))) {
    return res.status(415).json({ message: err.message });
  }

  // CORS rejection
  if (err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({ message: err.message });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
