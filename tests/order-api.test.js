"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const db = require("../db");
const onRequest = require("../server");

const customerId = "2f96e66b-7e6a-4e4b-a190-26c006de6744";
const otherCustomerId = "2f96e66b-7e6a-4e4b-a190-26c006de6745";
const customer = {
  name: "Test Customer", email: "test@example.com", phone: "+91 90000 00000",
  address: "1 Sample Street", city: "Bengaluru", postalCode: "560001"
};
const initialProductPrice = 4800;

test("order API recovers retries and scopes attempt lookup to the signed-in customer", async (t) => {
  const dbMethods = ["readCustomerBySession", "readContent", "createOrder", "findOrderByIdempotencyKey"];
  const savedDb = Object.fromEntries(dbMethods.map((name) => [name, db[name]]));
  const savedRateSecret = process.env.QB_RATE_LIMIT_SECRET;
  process.env.QB_RATE_LIMIT_SECRET = "test-only-rate-limit-secret";

  const orders = new Map();
  let productPrice = initialProductPrice;
  db.readCustomerBySession = async (token) => token === "a".repeat(64)
    ? { id: customerId, email: customer.email, name: customer.name }
    : token === "b".repeat(64)
      ? { id: otherCustomerId, email: "other@example.com", name: "Other Customer" }
      : null;
  db.readContent = async () => ({ products: [{
    slug: "soft-armor-hoodie", name: "Soft Armor Hoodie", image: "/assets/soft-armor.svg",
    price: productPrice, sizes: ["S", "M", "L"]
  }] });
  db.findOrderByIdempotencyKey = async (ownerId, key) => {
    const record = orders.get(ownerId + ":" + key);
    return record ? { order: record.order, requestHash: record.requestHash } : null;
  };
  db.createOrder = async (shipping, items, subtotal, ownerId, key, requestHash) => {
    const mapKey = ownerId + ":" + key;
    const prior = orders.get(mapKey);
    if (prior) {
      if (prior.requestHash !== requestHash) {
        const error = new Error("This checkout key belongs to a different order attempt.");
        error.code = "IDEMPOTENCY_KEY_REUSED";
        throw error;
      }
      return { order: prior.order, replayed: true };
    }
    const order = {
      id: crypto.randomUUID(), orderNumber: "QB-TEST-0001", customerId: ownerId,
      customer: shipping, items, subtotal, paymentMethod: "test_qr", paymentStatus: "Not payable",
      status: "Demo recorded", orderState: "demo_recorded", fulfillmentStatus: "not_applicable"
    };
    orders.set(mapKey, { order, requestHash });
    return { order, replayed: false };
  };

  const server = http.createServer(onRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const [name, value] of Object.entries(savedDb)) db[name] = value;
    if (savedRateSecret === undefined) delete process.env.QB_RATE_LIMIT_SECRET;
    else process.env.QB_RATE_LIMIT_SECRET = savedRateSecret;
  });

  const base = "http://127.0.0.1:" + server.address().port;
  async function request(path, { token, key, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = "Bearer " + token;
    if (key) headers["Idempotency-Key"] = key;
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET", headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json() };
  }
  const key = "e5b15d8f-cd47-40b3-a07c-c530cfc5f9c8";
  const payload = {
    customer,
    items: [{ slug: "soft-armor-hoodie", size: "M", qty: 1 }],
    expectedSubtotal: initialProductPrice,
    noPaymentAcknowledged: true
  };

  assert.equal((await request("/api/orders", { token: "a".repeat(64), body: payload })).status, 400,
    "rejects an order without an idempotency key");
  assert.equal((await request("/api/orders/attempt/" + key, { token: "a".repeat(64) })).status, 404,
    "reports a not-yet-recorded attempt");

  const first = await request("/api/orders", { token: "a".repeat(64), key, body: payload });
  assert.equal(first.status, 201);
  assert.equal(first.body.order.paymentStatus, "Not payable");
  assert.equal(first.body.order.status, "Demo recorded");

  productPrice = initialProductPrice + 500;
  const [retryA, retryB] = await Promise.all([
    request("/api/orders", { token: "a".repeat(64), key, body: payload }),
    request("/api/orders", { token: "a".repeat(64), key, body: payload })
  ]);
  assert.deepEqual([retryA.status, retryB.status].sort(), [200, 200],
    "retries return the recorded order even after a lost response or catalogue price update");
  assert.equal(retryA.body.order.id, first.body.order.id);
  assert.equal(orders.size, 1, "one key creates one order");

  const changedPayload = { ...payload, customer: { ...customer, city: "Mysuru" } };
  const mismatch = await request("/api/orders", { token: "a".repeat(64), key, body: changedPayload });
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.body.code, "IDEMPOTENCY_KEY_REUSED");

  const recovered = await request("/api/orders/attempt/" + key, { token: "a".repeat(64) });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.order.id, first.body.order.id);
  assert.equal((await request("/api/orders/attempt/" + key, { token: "b".repeat(64) })).status, 404,
    "an order attempt cannot be read by another customer");

  const staleKey = "f7b4a324-877c-4e45-91ab-2f584f7611e3";
  const staleTotal = await request("/api/orders", {
    token: "a".repeat(64), key: staleKey, body: { ...payload, expectedSubtotal: initialProductPrice }
  });
  assert.equal(staleTotal.status, 409, "a new order still checks the current server price");
  assert.equal(orders.size, 1);
});
