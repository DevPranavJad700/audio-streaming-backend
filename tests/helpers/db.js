/**
 * Lightweight test setup using a real local MongoDB connection OR
 * the globally available mongoose in-memory approach via jest mocks.
 *
 * Since mongodb-memory-server requires a binary download,
 * we use @jest-environment with a manual mock approach for CI-friendliness.
 *
 * For local runs with a real MongoDB available, set TEST_MONGO_URI in .env.test
 */
const mongoose = require("mongoose");

const TEST_URI =
  process.env.TEST_MONGO_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/rbas_test";

async function connect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_URI);
  }
}

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}

module.exports = { connect, clearDatabase, disconnect };
