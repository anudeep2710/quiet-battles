"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const seedContent = require("../data/content.json");
const db = require("../db");
const onRequest = require("../server");

async function main() {
  const email = "owner@example.com";
  const password = "local test password";
  const key = "local-test-studio-key-123";
  const savedEnv = Object.fromEntries(["QB_ADMIN_KEY"].map((name) => [name, process.env[name]]));
  const dbMethods = ["findAdminAccount", "createAdminAccount", "createSession", "hasSession", "deleteSession", "readOrders", "readContent", "readProductOrderStats", "consumeAuthAttempt", "writeContent", "pruneUnusedMedia"];
  const savedDb = Object.fromEntries(dbMethods.map((name) => [name, db[name]]));
  const sessions = new Set();
  let account = null;
  let contentVersion = 1;
  let contentWrites = 0;
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
  db.readContent = async () => structuredClone(seedContent);
  db.readProductOrderStats = async () => [
    { slug: "soft-armor-hoodie", name: "An older hoodie name", unitsOrdered: 4, orderCount: 2 },
    { slug: "retired-still-point-cap", name: "Archived Still Point Cap", unitsOrdered: 1, orderCount: 1 }
  ];
  db.consumeAuthAttempt = async () => false;
  db.writeContent = async (_content, expectedVersion) => {
    if (expectedVersion !== contentVersion) {
      const error = new Error("The archive changed after you opened Studio.");
      error.code = "CONTENT_VERSION_CONFLICT";
      throw error;
    }
    contentWrites += 1;
    contentVersion += 1;
    return contentVersion;
  };
  db.pruneUnusedMedia = async () => {};

  const server = http.createServer(onRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  async function request(route, body, headers, method) {
    const response = await fetch(base + route, {
      method: method || (body === undefined ? "GET" : "POST"),
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

    assert.equal((await request("/api/admin/content", { ...seedContent, contentVersion: 1 }, undefined, "PUT")).status, 401,
      "product catalogue changes require an authenticated Studio session");
    assert.equal((await request("/api/admin/product-activity")).status, 401,
      "product activity must not be exposed to visitors without an authenticated Studio session");
    assert.equal((await request("/api/admin/upload", { data: "" })).status, 401,
      "product images cannot be uploaded without an authenticated Studio session");
    assert.equal(contentWrites, 0, "unauthenticated requests must not write content");

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
    const productActivity = await request("/api/admin/product-activity", undefined, auth);
    assert.equal(productActivity.status, 200);
    assert.equal(productActivity.body.totalUnitsOrdered, 5);
    assert.deepEqual(productActivity.body.products.find((item) => item.slug === "soft-armor-hoodie"), {
      slug: "soft-armor-hoodie", name: seedContent.products.find((item) => item.slug === "soft-armor-hoodie").name,
      unitsOrdered: 4, orderCount: 2
    }, "current product names should be used with recorded demo quantities");
    assert.ok(productActivity.body.products.some((item) => item.slug === "retired-still-point-cap" && item.unitsOrdered === 1),
      "products removed from the current catalogue remain visible in the order history summary");
    assert.equal(Object.hasOwn(productActivity.body.products[0], "customer"), false,
      "the aggregate endpoint must not include customer records");
    assert.equal((await request("/api/admin/orders/5f7220cb-0876-4c65-9c68-87b2fd924512", { status: "Shipped" }, auth, "PATCH")).status, 409,
      "Studio cannot advance a non-payable test order to fulfilment");
    assert.equal((await request("/api/admin/content", seedContent, auth, "PUT")).status, 428,
      "Studio requires a content version before writing");
    const invalidProducts = [
      ["name", " "], ["kind", ""], ["category", " "], ["description", ""],
      ["price", 0], ["image", ""], ["sizes", []], ["sizes", [" "]],
      ["details", []], ["details", ["\t"]], ["chapterSlug", "missing-chapter"], ["slug", ""]
    ];
    for (const [field, value] of invalidProducts) {
      const invalidContent = structuredClone(seedContent);
      invalidContent.contentVersion = 1;
      invalidContent.products[0][field] = value;
      const invalidSave = await request("/api/admin/content", invalidContent, auth, "PUT");
      assert.equal(invalidSave.status, 400, "invalid product field should be rejected: " + field);
    }
    assert.equal(contentWrites, 0, "invalid product drafts must not be saved");
    const savedContent = await request("/api/admin/content", { ...seedContent, contentVersion: 1 }, auth, "PUT");
    assert.equal(savedContent.status, 200);
    assert.equal(savedContent.body.contentVersion, 2);
    assert.equal(contentWrites, 1, "valid product content should save once");
    const staleContent = await request("/api/admin/content", { ...seedContent, contentVersion: 1 }, auth, "PUT");
    assert.equal(staleContent.status, 409, "a stale Studio tab cannot overwrite newer content");
    assert.equal((await request("/api/admin/logout", {}, auth)).status, 200);
    assert.equal((await request("/api/admin/orders", undefined, auth)).status, 401);
    console.log("Studio API test passed: owner setup, login, admin-only writes and analytics, product activity aggregation, required product fields, versioned saves, safe order state, and logout.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    Object.assign(db, savedDb);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
