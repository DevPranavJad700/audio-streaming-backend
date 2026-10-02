require("dotenv").config();
const mongoose = require("mongoose");
const logger = require("./src/utils/logger");

// ─── Validate required environment variables before anything starts ───────────
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET", "IMAGEKIT_PRIVATE_KEY"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  logger.error(`[startup] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const app = require("./src/app");
const connectDB = require("./src/db/db");

const PORT = process.env.PORT || 3000;
let server;

async function start() {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
      logger.info(`Interactive API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error("Failed to bootstrap server:", error);
    process.exit(1);
  }
}

start();

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      logger.info("HTTP server closed.");
      try {
        await mongoose.connection.close(false);
        logger.info("MongoDB connection closed.");
        process.exit(0);
      } catch (err) {
        logger.error("Error closing MongoDB connection:", err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// ─── Unhandled Rejections & Uncaught Exceptions ──────────────────────────────
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});
