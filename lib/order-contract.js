"use strict";

const crypto = require("node:crypto");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeIdempotencyKey(value) {
  if (typeof value !== "string") return "";
  const key = value.trim().toLowerCase();
  return UUID_PATTERN.test(key) ? key : "";
}

function orderRequestFingerprint(customer, items) {
  const normalizedCustomer = {
    name: String(customer.name || "").trim(),
    email: String(customer.email || "").trim().toLowerCase(),
    phone: String(customer.phone || "").trim(),
    address: String(customer.address || "").trim(),
    city: String(customer.city || "").trim(),
    postalCode: String(customer.postalCode || "").trim()
  };
  const normalizedItems = items.map((item) => ({
    slug: item.slug,
    size: item.size,
    qty: item.qty
  })).sort((left, right) =>
    left.slug.localeCompare(right.slug) || left.size.localeCompare(right.size)
  );
  return crypto.createHash("sha256")
    .update(JSON.stringify({ customer: normalizedCustomer, items: normalizedItems }))
    .digest("hex");
}

module.exports = { normalizeIdempotencyKey, orderRequestFingerprint };
