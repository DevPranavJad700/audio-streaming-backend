const mongoose = require("mongoose");
const logger = require("../utils/logger");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("Database Connected Successfully");
  } catch (error) {
    logger.error("Database Connection Error:", error);
    throw error;
  }
}

module.exports = connectDB;
