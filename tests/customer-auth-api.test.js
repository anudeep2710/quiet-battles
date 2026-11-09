"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const db = require("../db");
const onRequest = require("../server");

const scrypt = promisify(crypto.scrypt);
const savedMethods = [
  "createCustomer", "findCustomerByEmail", "createCustomerSession", "readCustomerBySession",
  "readCustomerOrders", "consumeAuthAttempt"
];

test("customer signup avoids account enumeration and auth limits are enforced", async (t) => {
  const savedDb = Object.fromEntries(savedMethods.map((name) => [name, db[name]]));
  const savedSecret = process.env.QB_RATE_LIMIT_SECRET;
  process.env.QB_RATE_LIMIT_SECRET = "test-only-customer-auth-secret";
  const accounts = new Map();
  const sessions = new Map();
  const attempts = new Map();
  let forceRateLimit = false;

  db.createCustomer = async (name, email, passwordHash, passwordSalt) => {
    if (accounts.has(email)) {
      const error = new Error("duplicate email");
      error.code = "23505";
      throw error;
    }
    const record = { id: crypto.randomUUID(), name, email, password_hash: passwordHash, password_salt: passwordSalt };
    accounts.set(email, record);
    return record;
  };
  db.findCustomerByEmail = async (email) => accounts.get(email) || null;
  db.createCustomerSession = async (token, customerId) => { sessions.set(token, customerId); };
  db.readCustomerBySession = async (token) => {
    const record = Array.from(accounts.values()).find((item) => item.id === sessions.get(token));
    return record ? { id: record.id, name: record.name, email: record.email } : null;
  };
  db.readCustomerOrders = async () => [];
  db.consumeAuthAttempt = async (bucket, _windowMs, maxAttempts) => {
    if (forceRateLimit) return true;
    const count = (attempts.get(bucket) || 0) + 1;
    attempts.set(bucket, count);
    return count > maxAttempts;
  };

  const server = http.createServer(onRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const [name, value] of Object.entries(savedDb)) db[name] = value;
    if (savedSecret === undefined) delete process.env.QB_RATE_LIMIT_SECRET;
    else process.env.QB_RATE_LIMIT_SECRET = savedSecret;
  });

  const base = "http://127.0.0.1:" + server.address().port;
  async function request(route, body, token) {
    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json() };
  }

  const signupBody = { name: "Test Customer", email: "person@example.com", password: "sample-pass-123", confirmPassword: "sample-pass-123" };
  const created = await request("/api/auth/signup", signupBody);
  const duplicate = await request("/api/auth/signup", { ...signupBody, name: "Someone Else" });
  assert.equal(created.status, 202);
  assert.deepEqual(duplicate, created, "new and existing addresses receive the same response");
  assert.equal(accounts.size, 1);
  assert.notEqual(accounts.get(signupBody.email).password_hash, signupBody.password);

  const unknownEmail = await request("/api/auth/login", { email: "missing@example.com", password: "sample-pass-123" });
  const wrongPassword = await request("/api/auth/login", { email: signupBody.email, password: "incorrect-pass-123" });
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.body.error, wrongPassword.body.error);

  const valid = await request("/api/auth/login", { email: signupBody.email.toUpperCase(), password: signupBody.password });
  assert.equal(valid.status, 200);
  assert.ok(valid.body.token);
  assert.equal((await request("/api/auth/me", undefined, valid.body.token)).status, 200);

  forceRateLimit = true;
  const limited = await request("/api/auth/login", { email: signupBody.email, password: signupBody.password });
  assert.equal(limited.status, 429);
});
