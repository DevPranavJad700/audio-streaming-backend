const request = require("supertest");
const app = require("../../src/app");

/**
 * Register a user and return the Set-Cookie header array.
 * @param {object} overrides — fields to merge into the default payload
 */
async function registerAndGetCookies(overrides = {}) {
  const payload = {
    username: "testartist",
    email: "artist@test.com",
    password: "password123",
    role: "artist",
    ...overrides,
  };
  const res = await request(app).post("/api/auth/register").send(payload);
  return { cookies: res.headers["set-cookie"], body: res.body, status: res.status };
}

/**
 * Login and return the Set-Cookie header array.
 */
async function loginAndGetCookies(credentials = {}) {
  const payload = {
    email: "artist@test.com",
    password: "password123",
    ...credentials,
  };
  const res = await request(app).post("/api/auth/login").send(payload);
  return { cookies: res.headers["set-cookie"], body: res.body, status: res.status };
}

module.exports = { registerAndGetCookies, loginAndGetCookies };
