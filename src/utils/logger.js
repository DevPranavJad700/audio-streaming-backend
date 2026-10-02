const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Ensure logs/ directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) =>
    stack
      ? `${timestamp} ${level}: ${message}\n${stack}`
      : `${timestamp} ${level}: ${message}`,
  ),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json(),
);

const isTest = process.env.NODE_ENV === "test";
const isProd = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  level: isProd ? "warn" : "debug",
  format: isProd ? prodFormat : devFormat,
  silent: isTest, // no noise during test runs
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: prodFormat, // always JSON in files
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      format: prodFormat,
    }),
  ],
});

// Pipe Morgan HTTP logs into Winston
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
