"use strict";

const assert = require("node:assert/strict");

const base = process.argv[2] || "http://127.0.0.1:4174";
const studioKey = process.env.QB_ADMIN_KEY;
const studioEmail = process.env.QB_ADMIN_EMAIL;
const studioPassword = process.env.QB_ADMIN_TEST_PASSWORD;
if (!studioKey || !studioEmail || !studioPassword) {
  throw new Error("Set QB_ADMIN_KEY, QB_ADMIN_EMAIL, and QB_ADMIN_TEST_PASSWORD in .env.local before the disposable-database smoke test.");
}

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
  assert.equal(initial.body.products.length, 8);
  assert.deepEqual(initial.body.products.map((product) => product.slug), [
    "soft-armor-hoodie", "carry-light-overshirt", "quiet-form-tee", "still-point-cap",
    "quiet-hours-crewneck", "grounded-trouser", "open-door-tote", "return-home-long-sleeve"
  ]);
  assert.equal(initial.body.products[0].secondaryImage, "/assets/soft-armor-back.svg");
  for (const product of initial.body.products) {
    const frontImage = await fetch(base + product.image);
    const alternateImage = await fetch(base + product.secondaryImage);
    assert.equal(frontImage.status, 200, product.image);
    assert.equal(alternateImage.status, 200, product.secondaryImage);
    assert.match(await alternateImage.text(), /back view/i);
  }

  const guestOrder = await jsonRequest("/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
  });
  assert.equal(guestOrder.response.status, 401);

  const denied = await jsonRequest("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: studioEmail, password: studioPassword, key: "incorrect-key" })
  });
  assert.equal(denied.response.status, 401);

  const wrongPassword = await jsonRequest("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: studioEmail, password: "incorrect-password", key: studioKey })
  });
  assert.equal(wrongPassword.response.status, 401);

  const wrongEmail = await jsonRequest("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "other@example.com", password: studioPassword, key: studioKey })
  });
  assert.equal(wrongEmail.response.status, 401);

  const keyOnly = await jsonRequest("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: studioKey })
  });
  assert.equal(keyOnly.response.status, 401);

  const login = await jsonRequest("/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: studioEmail, password: studioPassword, key: studioKey })
  });
  assert.equal(login.response.status, 200);
  const auth = { "Content-Type": "application/json", Authorization: "Bearer " + login.body.token };
  const original = initial.body;
  let changed = false;
  let orderId = "";
  let customerId = "";
  let customerToken = "";
  const customerEmail = "smoke." + Date.now() + "@example.com";
  try {
    const signup = await jsonRequest("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Archive Visitor", email: customerEmail, password: "quiet-test-2026" })
    });
    assert.equal(signup.response.status, 201, JSON.stringify(signup.body));
    customerId = signup.body.customer.id;
    customerToken = signup.body.token;
    assert.match(customerToken, /^[a-f0-9]{64}$/);

    const duplicate = await jsonRequest("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Archive Visitor", email: customerEmail.toUpperCase(), password: "quiet-test-2026" })
    });
    assert.equal(duplicate.response.status, 409);

    const badCustomerLogin = await jsonRequest("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail, password: "wrong-password" })
    });
    assert.equal(badCustomerLogin.response.status, 401);

    const me = await jsonRequest("/api/auth/me", { headers: { Authorization: "Bearer " + customerToken } });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.customer.email, customerEmail);
    assert.deepEqual(me.body.orders, []);

    const orderProduct = initial.body.products[0];
    const orderCustomer = {
      name: "Test Visitor", email: "visitor@example.com", phone: "+91 90000 00000",
      address: "1 Sample Street", city: "Bengaluru", postalCode: "560001"
    };
    const staleQuote = await jsonRequest("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + customerToken },
      body: JSON.stringify({
        customer: orderCustomer,
        items: [{ slug: orderProduct.slug, size: "M", qty: 1 }],
        expectedSubtotal: orderProduct.price + 1,
        noPaymentAcknowledged: true
      })
    });
    assert.equal(staleQuote.response.status, 409);

    const duplicateVariant = await jsonRequest("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + customerToken },
      body: JSON.stringify({
        customer: orderCustomer,
        items: [
          { slug: orderProduct.slug, size: "M", qty: 1 },
          { slug: orderProduct.slug, size: "M", qty: 1 }
        ],
        expectedSubtotal: orderProduct.price * 2,
        noPaymentAcknowledged: true
      })
    });
    assert.equal(duplicateVariant.response.status, 400);

    const excessiveQuantity = await jsonRequest("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + customerToken },
      body: JSON.stringify({
        customer: orderCustomer,
        items: [{ slug: orderProduct.slug, size: "M", qty: 11 }],
        expectedSubtotal: orderProduct.price * 11,
        noPaymentAcknowledged: true
      })
    });
    assert.equal(excessiveQuantity.response.status, 400);

    const customerList = await jsonRequest("/api/admin/customers", { headers: auth });
    assert.equal(customerList.response.status, 200);
    assert.ok(customerList.body.customers.some((item) => item.id === customerId && item.orderCount === 0));

    const unsupportedImageContent = structuredClone(original);
    unsupportedImageContent.hero.image = "https://untrusted.example/quiet-battles.webp";
    const unsupportedImage = await jsonRequest("/api/admin/content", {
      method: "PUT", headers: auth, body: JSON.stringify(unsupportedImageContent)
    });
    assert.equal(unsupportedImage.response.status, 400);

    const createdOrder = await jsonRequest("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + customerToken },
      body: JSON.stringify({
        customer: orderCustomer,
        items: [{ slug: orderProduct.slug, size: "M", qty: 1 }],
        expectedSubtotal: orderProduct.price,
        noPaymentAcknowledged: true
      })
    });
    assert.equal(createdOrder.response.status, 201, JSON.stringify(createdOrder.body));
    orderId = createdOrder.body.order.id;
    assert.match(createdOrder.body.order.orderNumber, /^QB-\d{8}-[A-F0-9]{6}$/);
    assert.equal(createdOrder.body.order.subtotal, initial.body.products[0].price);
    assert.equal(createdOrder.body.order.paymentMethod, "test_qr");
    assert.equal(createdOrder.body.order.customerId, customerId);

    const meWithOrder = await jsonRequest("/api/auth/me", { headers: { Authorization: "Bearer " + customerToken } });
    assert.equal(meWithOrder.response.status, 200);
    assert.ok(meWithOrder.body.orders.some((order) => order.id === orderId));

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
      slug: "verification-piece", name: "Verification Piece", kind: "Layers", category: "TEST",
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
    assert.equal(updated.body.products.length, 9);
    assert.equal(updated.body.products[8].slug, "verification-piece");

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

    const customerLogout = await jsonRequest("/api/auth/logout", {
      method: "POST", headers: { Authorization: "Bearer " + customerToken }
    });
    assert.equal(customerLogout.response.status, 200);
    const customerAfterLogout = await jsonRequest("/api/auth/me", {
      headers: { Authorization: "Bearer " + customerToken }
    });
    assert.equal(customerAfterLogout.response.status, 401);

    const customerLogin = await jsonRequest("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail, password: "quiet-test-2026" })
    });
    assert.equal(customerLogin.response.status, 200);
    customerToken = customerLogin.body.token;
    assert.ok(customerLogin.body.orders.some((order) => order.id === orderId));
  } finally {
    const cleanupErrors = [];
    async function cleanup(label, action) {
      try {
        await action();
      } catch (error) {
        cleanupErrors.push(label + ": " + error.message);
      }
    }
    if (orderId) {
      await cleanup("remove test order", async () => {
        const removedOrder = await jsonRequest("/api/admin/orders/" + orderId, {
          method: "DELETE", headers: { Authorization: "Bearer " + login.body.token }
        });
        assert.equal(removedOrder.response.status, 200, JSON.stringify(removedOrder.body));
      });
    }
    if (changed) {
      await cleanup("restore original content", async () => {
        const restored = await jsonRequest("/api/admin/content", {
          method: "PUT", headers: auth, body: JSON.stringify(original)
        });
        assert.equal(restored.response.status, 200, JSON.stringify(restored.body));
      });
    }
    if (customerId) {
      await cleanup("remove test customer", async () => {
        const removedCustomer = await jsonRequest("/api/admin/customers/" + customerId, {
          method: "DELETE", headers: { Authorization: "Bearer " + login.body.token }
        });
        assert.equal(removedCustomer.response.status, 200, JSON.stringify(removedCustomer.body));
      });
    }
    await cleanup("revoke Studio session", async () => {
      const logout = await jsonRequest("/api/admin/logout", {
        method: "POST", headers: { Authorization: "Bearer " + login.body.token }
      });
      assert.equal(logout.response.status, 200);
    });
    if (cleanupErrors.length) throw new Error("Cleanup issues: " + cleanupErrors.join("; "));
  }

  const afterLogout = await jsonRequest("/api/admin/content", {
    method: "PUT", headers: auth, body: JSON.stringify(original)
  });
  assert.equal(afterLogout.response.status, 401);
  const ordersAfterLogout = await jsonRequest("/api/admin/orders", { headers: auth });
  assert.equal(ordersAfterLogout.response.status, 401);
  const customersAfterLogout = await jsonRequest("/api/admin/customers", { headers: auth });
  assert.equal(customersAfterLogout.response.status, 401);
  console.log("Smoke test passed: site, eight-product catalogue, guest-order rejection, customer accounts, linked order history, Neon reads/writes, Studio controls, login/logout, and media upload.");
}

main().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exitCode = 1;
});
