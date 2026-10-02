module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 30000,
  verbose: true,
  // Clear mock state between tests
  clearMocks: true,
  // Force exit after all tests complete (prevents open handle warnings)
  forceExit: true,
  // Detect open handles for debugging
  detectOpenHandles: false,
};
