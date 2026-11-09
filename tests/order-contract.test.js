"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeIdempotencyKey, orderRequestFingerprint } = require("../lib/order-contract");

const key = "7f0c6a2f-6620-4f3a-9a89-5a2c2d2e71a1";
const customer = {
  name: "Example Customer", email: "shopper@example.com", phone: "+91 90000 00000",
  address: "1 Sample Street", city: "Bengaluru", postalCode: "560001"
};
const items = [
  { slug: "soft-armor-hoodie", size: "M", qty: 1 },
  { slug: "quiet-form-tee", size: "S", qty: 2 }
];

test("accepts and normalizes UUID checkout keys only", () => {
  assert.equal(normalizeIdempotencyKey(key.toUpperCase()), key);
  assert.equal(normalizeIdempotencyKey("not-a-key"), "");
  assert.equal(normalizeIdempotencyKey(""), "");
  assert.equal(normalizeIdempotencyKey(null), "");
});

test("fingerprint is stable when identical cart lines arrive in a different order", () => {
  assert.equal(orderRequestFingerprint(customer, items),
    orderRequestFingerprint({ ...customer, email: customer.email.toUpperCase() }, [...items].reverse()));
});

test("fingerprint changes when delivery details, variant, or quantity changes", () => {
  const initial = orderRequestFingerprint(customer, items);
  assert.notEqual(orderRequestFingerprint({ ...customer, city: "Mysuru" }, items), initial);
  assert.notEqual(orderRequestFingerprint(customer, [{ ...items[0], qty: 2 }, items[1]]), initial);
  assert.notEqual(orderRequestFingerprint(customer, [{ ...items[0], size: "L" }, items[1]]), initial);
});

test("fingerprint is independent of catalogue prices so a retry replays its original order", () => {
  const initial = orderRequestFingerprint(customer, items);
  const unchangedCartWithNewCataloguePrice = items.map((item) => ({ ...item, unitPrice: 9900 }));
  assert.equal(orderRequestFingerprint(customer, unchangedCartWithNewCataloguePrice), initial);
});
