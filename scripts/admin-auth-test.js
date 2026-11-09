"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const db = require("../db");
const onRequest = require("../server");

async function main() {
  const email = "owner@example.com";
  const password = "local test password";
  const key = "local-test-studio-key-123";
  const savedEnv = Object.fromEntries(["QB_ADMIN_KEY"].map((name) => [name, process.env[name]]));
  const dbMethods = ["findAdminAccount", "createAdminAccount", "createSession", "hasSession", "deleteSession", "readOrders"];
  const savedDb = Object.fromEntries(dbMethods.map((name) => [name, db[name]]));
  const sessions = new Set();
  let account = null;
  process.env.QB_ADMIN_KEY = key;
  db.findAdminAccount = async () => account;
  db.createAdminAccount = async (newEmail, passwordHash, passwordSalt) => {
    if (account) return null;
    account = { id: 1, email: newEmail, password_hash: passwordHash, password_salt: passwordSalt };
    return account;
  };
  db.createSession = async (token) => { sessions.add(token); };
  db.hasSession = async (token) => sessions.has(token);
  db.deleteSession = async (token) => { sessions.delete(token); };
  db.readOrders = async () => [];

  const server = http.createServer(onRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  async function request(route, body, headers) {
    const response = await fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(headers || {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  }

  try {
    assert.deepEqual((await request("/api/admin/setup-status")).body, { configured: false });
    assert.equal((await request("/api/admin/login", { email, password, key })).status, 401);
    assert.equal((await request("/api/admin/setup", {
      email, password, confirmPassword: "does not match", key
    })).status, 400);
    assert.equal((await request("/api/admin/setup", {
      email, password: "short", confirmPassword: "short", key
    })).status, 400);
    assert.equal((await request("/api/admin/setup", {
      email, password, confirmPassword: password, key: "wrong-key"
    })).status, 401);

    const concurrentSetups = await Promise.all([
      request("/api/admin/setup", { email: email.toUpperCase(), password, confirmPassword: password, key }),
      request("/api/admin/setup", { email, password, confirmPassword: password, key })
    ]);
    assert.deepEqual(concurrentSetups.map((result) => result.status).sort(), [201, 409]);
    const created = concurrentSetups.find((result) => result.status === 201);
    assert.match(created.body.token, /^[a-f0-9]{64}$/);
    assert.notEqual(account.password_hash, password);
    assert.equal((await request("/api/admin/setup", { email, password, confirmPassword: password, key })).status, 409);
    assert.deepEqual((await request("/api/admin/setup-status")).body, { configured: true });

    for (const invalid of [
      { email, password, key: "wrong-key" },
      { email, password: "wrong-password", key },
      { email: "other@example.com", password, key },
      null
    ]) {
      const result = await request("/api/admin/login", invalid);
      assert.equal(result.status, 401);
      assert.equal(result.body.error, "Studio credentials are not correct.");
    }
    const login = await request("/api/admin/login", { email: email.toUpperCase(), password, key });
    assert.equal(login.status, 200);
    assert.match(login.body.token, /^[a-f0-9]{64}$/);
    const auth = { Authorization: "Bearer " + login.body.token };
    assert.equal((await request("/api/admin/session", undefined, auth)).status, 200);
    assert.equal((await request("/api/admin/orders", undefined, auth)).status, 200);
    assert.equal((await request("/api/admin/logout", {}, auth)).status, 200);
    assert.equal((await request("/api/admin/orders", undefined, auth)).status, 401);
    console.log("Admin auth test passed: first-run setup, concurrent registration, validation, login, protected session, and logout.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    Object.assign(db, savedDb);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
