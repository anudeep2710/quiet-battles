"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = process.argv[2] || "http://127.0.0.1:4174";
const studioKey = fs.readFileSync(path.join(__dirname, "..", ".studio-key"), "utf8").trim();

async function jsonRequest(route, options) {
  const response = await fetch(base + route, options);
  const body = await response.json();
  return { response, body };
}

async function main() {
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /QUIET BATTLES/);

  const health = await jsonRequest("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.database, "Neon Postgres");

  const initial = await jsonRequest("/api/content");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.seriesList.length, 1);
  assert.equal(initial.body.seriesList[0].chapters.length, 5);
  assert.equal(initial.body.products.length, 1);
  assert.equal(initial.body.products[0].secondaryImage, "/assets/soft-armor-back.svg");
  const alternateImage = await fetch(base + initial.body.products[0].secondaryImage);
  assert.equal(alternateImage.status, 200);
  assert.match(await alternateImage.text(), /back view/i);

  const denied = await jsonRequest("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "incorrect-key" })
  });
  assert.equal(denied.response.status, 401);

  const login = await jsonRequest("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: studioKey })
  });
  assert.equal(login.response.status, 200);
  const auth = { "Content-Type": "application/json", Authorization: "Bearer " + login.body.token };
  const original = initial.body;
  let changed = false;
  let orderId = "";
  try {
    const createdOrder = await jsonRequest("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: "Assessment Visitor", email: "visitor@example.com", phone: "+91 90000 00000",
          address: "1 Demo Street", city: "Bengaluru", postalCode: "560001"
        },
        items: [{ slug: initial.body.products[0].slug, size: "M", qty: 1 }],
        demoAcknowledged: true
      })
    });
    assert.equal(createdOrder.response.status, 201, JSON.stringify(createdOrder.body));
    orderId = createdOrder.body.order.id;
    assert.match(createdOrder.body.order.orderNumber, /^QB-\d{8}-[A-F0-9]{6}$/);
    assert.equal(createdOrder.body.order.subtotal, initial.body.products[0].price);
    assert.equal(createdOrder.body.order.paymentMethod, "demo_qr");

    const orderList = await jsonRequest("/api/admin/orders", { headers: auth });
    assert.equal(orderList.response.status, 200);
    assert.ok(orderList.body.orders.some((order) => order.id === orderId));
    const orderUpdate = await jsonRequest("/api/admin/orders/" + orderId, {
      method: "PATCH", headers: auth, body: JSON.stringify({ status: "Confirmed" })
    });
    assert.equal(orderUpdate.response.status, 200, JSON.stringify(orderUpdate.body));
    assert.equal(orderUpdate.body.order.status, "Confirmed");

    const temporary = structuredClone(original);
    temporary.seriesList[0].chapters[0].title = "Verification edit";
    temporary.seriesList.push({
      slug: "verification-series", number: "SERIES 99", title: "Verification Series",
      subtitle: "Temporary verification series.", description: "Temporary verification entry.",
      image: temporary.seriesList[0].image,
      chapters: [{
        number: "CHAPTER 01", slug: "verification-chapter", title: "Verification Chapter",
        excerpt: "Temporary verification entry.", image: temporary.seriesList[0].image,
        productSlug: "verification-piece", story: ["A temporary test story."]
      }]
    });
    temporary.products.push({
      slug: "verification-piece", name: "Verification Piece", category: "TEST",
      description: "Temporary verification product.", price: 100,
      image: "/assets/soft-armor.svg", sizes: ["M"], details: ["Sample"],
      chapterSlug: "verification-chapter"
    });
    const saved = await jsonRequest("/api/admin/content", {
      method: "PUT", headers: auth, body: JSON.stringify(temporary)
    });
    assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
    changed = true;
    const updated = await jsonRequest("/api/content");
    assert.equal(updated.body.seriesList.length, 2);
    assert.equal(updated.body.seriesList[0].chapters.length, 5);
    assert.equal(updated.body.seriesList[0].chapters[0].title, "Verification edit");
    assert.equal(updated.body.seriesList[1].chapters[0].slug, "verification-chapter");
    assert.equal(updated.body.products.length, 2);
    assert.equal(updated.body.products[1].slug, "verification-piece");

    const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
    const upload = await jsonRequest("/api/admin/upload", {
      method: "POST", headers: auth,
      body: JSON.stringify({ data: "data:image/png;base64," + imageBase64 })
    });
    assert.equal(upload.response.status, 201, JSON.stringify(upload.body));
    const image = await fetch(base + upload.body.url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.ok((await image.arrayBuffer()).byteLength > 60);
  } finally {
    if (orderId) {
      const removedOrder = await jsonRequest("/api/admin/orders/" + orderId, {
        method: "DELETE", headers: { Authorization: "Bearer " + login.body.token }
      });
      assert.equal(removedOrder.response.status, 200, JSON.stringify(removedOrder.body));
    }
    if (changed) {
      const restored = await jsonRequest("/api/admin/content", {
        method: "PUT", headers: auth, body: JSON.stringify(original)
      });
      assert.equal(restored.response.status, 200);
    }
    const logout = await jsonRequest("/api/admin/logout", {
      method: "POST", headers: { Authorization: "Bearer " + login.body.token }
    });
    assert.equal(logout.response.status, 200);
  }

  const afterLogout = await jsonRequest("/api/admin/content", {
    method: "PUT", headers: auth, body: JSON.stringify(original)
  });
  assert.equal(afterLogout.response.status, 401);
  const ordersAfterLogout = await jsonRequest("/api/admin/orders", { headers: auth });
  assert.equal(ordersAfterLogout.response.status, 401);
  console.log("Smoke test passed: site, Neon reads/writes, checkout order lifecycle, Studio order controls, login/logout, and media upload.");
}

main().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exitCode = 1;
});
