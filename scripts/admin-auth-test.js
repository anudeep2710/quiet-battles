"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const db = require("../db");
const onRequest = require("../server");

async function main() {
  const email = "owner@example.com";
  const password = "local test password";
  const key = "local-test-studio-key-123";
  const salt = crypto.randomBytes(16).toString("hex");
  const savedEnv = Object.fromEntries(["QB_ADMIN_EMAIL", "QB_ADMIN_KEY", "QB_ADMIN_PASSWORD_HASH"].map((name) => [name, process.env[name]]));
  const savedDb = Object.fromEntries(["createSession", "hasSession", "deleteSession", "readOrders"].map((name) => [name, db[name]]));
  const sessions = new Set();
  process.env.QB_ADMIN_EMAIL = email;
  process.env.QB_ADMIN_KEY = key;
  process.env.QB_ADMIN_PASSWORD_HASH = salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex");
  db.createSession = async (token) => { sessions.add(token); };
  db.hasSession = async (token) => sessions.has(token);
  db.deleteSession = async (token) => { sessions.delete(token); };
  db.readOrders = async () => [];

  const server = http.createServer(onRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  async function login(body) {
    const response = await fetch(base + "/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }

  try {
    for (const invalid of [
      { key },
      { email, password, key: "wrong-key" },
      { email, password: "wrong-password", key },
      { email: "other@example.com", password, key },
      null
    ]) {
      const result = await login(invalid);
      assert.equal(result.status, 401);
      assert.equal(result.body.error, "Studio credentials are not correct.");
    }
    const valid = await login({ email: email.toUpperCase(), password, key });
    assert.equal(valid.status, 200);
    assert.match(valid.body.token, /^[a-f0-9]{64}$/);
    const auth = { Authorization: "Bearer " + valid.body.token };
    assert.equal((await fetch(base + "/api/admin/orders", { headers: auth })).status, 200);
    assert.equal((await fetch(base + "/api/admin/logout", { method: "POST", headers: auth })).status, 200);
    assert.equal((await fetch(base + "/api/admin/orders", { headers: auth })).status, 401);
    console.log("Admin auth test passed: all credentials required, session access, and logout.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    Object.assign(db, savedDb);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
