"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const db = require("./db");
const { normalizeIdempotencyKey, orderRequestFingerprint } = require("./lib/order-contract");

const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 4173);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const CUSTOMER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_AUTH_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_AUTH_MAX_ATTEMPTS = 10;
const CUSTOMER_AUTH_MAX_ATTEMPTS = 10;
const scryptAsync = promisify(crypto.scrypt);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function headers(type, cache = "no-store") {
  return {
    "Content-Type": type,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'"
  };
}

function send(res, status, body, type = "application/json; charset=utf-8", cache) {
  res.writeHead(status, headers(type, cache));
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function requestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function readJson(req, limit = 1024 * 1024) {
  if (req.body !== undefined && req.body !== null) {
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > limit) throw requestError("Request is too large.", 413);
    try { return typeof req.body === "string" ? JSON.parse(raw) : req.body; }
    catch { throw requestError("Send valid JSON."); }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(requestError("Request is too large.", 413));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(requestError("Send valid JSON.")); }
    });
    req.on("error", reject);
  });
}

function tokenFrom(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireAdmin(req, res) {
  if (await db.hasSession(tokenFrom(req))) return true;
  send(res, 401, { error: "Your studio session has expired. Sign in again." });
  return false;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validCustomerCredentials(body, includeName) {
  if (!isObject(body)) return false;
  const email = normalizeEmail(body.email);
  if (!validEmail(email) || typeof body.password !== "string" ||
      body.password.length < 8 || body.password.length > 128) return false;
  return !includeName || (typeof body.name === "string" && body.name.trim().length >= 2 && body.name.trim().length <= 80);
}

async function derivePassword(password, salt) {
  return (await scryptAsync(password, salt, 64)).toString("hex");
}

async function passwordMatches(password, salt, expected) {
  const actual = Buffer.from(await derivePassword(password, salt), "hex");
  const stored = Buffer.from(String(expected || ""), "hex");
  return actual.length === stored.length && crypto.timingSafeEqual(actual, stored);
}

async function adminPasswordMatches(password, account) {
  if (!account || !/^[a-f0-9]{128}$/.test(account.password_hash || "") ||
      !/^[a-f0-9]{32}$/.test(account.password_salt || "")) return false;
  return passwordMatches(password, account.password_salt, account.password_hash);
}

function clientAddress(req) {
  const platformAddress = process.env.VERCEL === "1" ? req.headers["x-real-ip"] : "";
  return String(platformAddress || req.socket?.remoteAddress || "unknown").slice(0, 128);
}

function authBucket(scope, value) {
  const secret = process.env.QB_RATE_LIMIT_SECRET || process.env.QB_ADMIN_KEY || process.env.DATABASE_URL || "";
  if (!secret) throw new Error("Configure a stable secret before rate limiting authentication.");
  return crypto.createHmac("sha256", secret).update(scope + "\u0000" + value).digest("hex");
}

async function rateLimitedAuth(req, scope, email, maxAttempts = CUSTOMER_AUTH_MAX_ATTEMPTS) {
  const buckets = [authBucket(scope, "ip:" + clientAddress(req))];
  if (email) buckets.push(authBucket(scope, "email:" + normalizeEmail(email)));
  for (const bucket of buckets) {
    if (await db.consumeAuthAttempt(bucket, ADMIN_AUTH_WINDOW_MS, maxAttempts)) return true;
  }
  return false;
}

async function startAdminSession() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  await db.createSession(token, expiresAt);
  return { token, expiresIn: 14400 };
}

async function startCustomerSession(customer) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_MS);
  await db.createCustomerSession(token, customer.id, expiresAt);
  return { token, expiresAt: expiresAt.toISOString() };
}

async function requireCustomer(req, res) {
  const customer = await db.readCustomerBySession(tokenFrom(req));
  if (customer) return customer;
  send(res, 401, { error: "Sign in to your private archive to continue." });
  return null;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validText(value, max = 2000) {
  return typeof value === "string" && value.length <= max;
}

function validRequiredText(value, max = 2000) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function validImage(value) {
  if (!validText(value, 2048)) return false;
  if (/^\/assets\/[a-zA-Z0-9._/-]+$/.test(value) ||
      /^\/api\/media\/[a-f0-9-]{36}$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "images.unsplash.com" &&
      !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function validContent(value) {
  if (!isObject(value) || !isObject(value.brand) || !isObject(value.hero) ||
      !isObject(value.introduction) || !Array.isArray(value.seriesList) ||
      !Array.isArray(value.products)) return false;
  if (value.seriesList.length < 1 || value.seriesList.length > 12 ||
      value.products.length < 1 || value.products.length > 100) return false;
  if (!["name", "tagline", "intro"].every((k) => validText(value.brand[k])) ||
      !["eyebrow", "title", "description"].every((k) => validText(value.hero[k])) ||
      !validImage(value.hero.image) ||
      !["eyebrow", "title", "copy"].every((k) => validText(value.introduction[k]))) return false;
  const seriesSlugs = new Set();
  const chapterSlugs = new Set();
  const allChapters = [];
  for (const series of value.seriesList) {
    if (!isObject(series) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(series.slug || "") ||
        seriesSlugs.has(series.slug) ||
        !["number", "title", "subtitle", "description"].every((k) => validText(series[k])) ||
        !validImage(series.image) || !Array.isArray(series.chapters) ||
        series.chapters.length < 1 || series.chapters.length > 30) return false;
    seriesSlugs.add(series.slug);
    for (const chapter of series.chapters) {
      if (!isObject(chapter) || !["number", "title", "excerpt", "productSlug"].every((k) => validText(chapter[k])) ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter.slug || "") ||
          chapterSlugs.has(chapter.slug) || !validImage(chapter.image) ||
          !Array.isArray(chapter.story) || chapter.story.length > 30 ||
          !chapter.story.every((item) => validText(item, 5000))) return false;
      chapterSlugs.add(chapter.slug);
      allChapters.push(chapter);
    }
  }
  const productSlugs = new Set();
  for (const product of value.products) {
    if (!isObject(product) ||
        !validRequiredText(product.name, 160) ||
        !validRequiredText(product.kind, 40) ||
        !validRequiredText(product.category, 120) ||
        !validRequiredText(product.description) ||
        !validRequiredText(product.chapterSlug, 120) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug || "") ||
        productSlugs.has(product.slug) || !validImage(product.image) ||
        (product.secondaryImage && !validImage(product.secondaryImage)) ||
        !Number.isInteger(product.price) || product.price < 1 || product.price > 10000000 ||
        !Array.isArray(product.sizes) || product.sizes.length < 1 || product.sizes.length > 30 ||
        !product.sizes.every((item) => validRequiredText(item, 30)) ||
        new Set(product.sizes.map((item) => item.trim().toLowerCase())).size !== product.sizes.length ||
        !Array.isArray(product.details) || product.details.length < 1 || product.details.length > 30 ||
        !product.details.every((item) => validRequiredText(item, 300)) ||
        !chapterSlugs.has(product.chapterSlug)) return false;
    productSlugs.add(product.slug);
  }
  return allChapters.every((chapter) => productSlugs.has(chapter.productSlug));
}

function validImageBytes(mime, bytes) {
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mime === "image/jpeg") return bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  if (mime === "image/webp") return bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP";
  return false;
}

function validOrderRequest(value) {
  if (!isObject(value) || !isObject(value.customer) || !Array.isArray(value.items) ||
      value.items.length < 1 || value.items.length > 20 || value.noPaymentAcknowledged !== true ||
      !Number.isSafeInteger(value.expectedSubtotal) || value.expectedSubtotal < 0) return false;
  const customer = value.customer;
  if (!["name", "email", "phone", "address", "city", "postalCode"].every((key) =>
      validText(customer[key], key === "address" ? 500 : 160) && customer[key].trim())) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
      !/^[+()\-\s0-9]{6,24}$/.test(customer.phone) ||
      !/^[a-zA-Z0-9\-\s]{3,14}$/.test(customer.postalCode)) return false;
  if (customer.website) return false;
  const variants = new Set();
  return value.items.every((item) => {
    if (!isObject(item) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug || "") ||
        !validText(item.size, 30) || !item.size.trim() ||
        !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 10) return false;
    const variant = item.slug + "\u0000" + item.size;
    if (variants.has(variant)) return false;
    variants.add(variant);
    return true;
  });
}

async function createOrder(body, customerId, idempotencyKey) {
  if (!validOrderRequest(body)) throw requestError("Check the customer details, bag items, and no-payment acknowledgement.");
  const customer = {
    name: body.customer.name.trim(),
    email: body.customer.email.trim().toLowerCase(),
    phone: body.customer.phone.trim(),
    address: body.customer.address.trim(),
    city: body.customer.city.trim(),
    postalCode: body.customer.postalCode.trim()
  };
  const requestHash = orderRequestFingerprint(customer, body.items);
  const existing = await db.findOrderByIdempotencyKey(customerId, idempotencyKey);
  if (existing) {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      const error = new Error("This checkout key belongs to a different order attempt. Recover the existing order before starting another.");
      error.code = "IDEMPOTENCY_KEY_REUSED";
      throw error;
    }
    return { order: existing.order, replayed: true };
  }

  const content = await db.readContent();
  const products = new Map(content.products.map((product) => [product.slug, product]));
  const items = body.items.map((line) => {
    const product = products.get(line.slug);
    if (!product || !product.sizes.includes(line.size)) {
      throw requestError("One of the selected products or sizes is no longer available.");
    }
    return {
      slug: product.slug,
      name: product.name,
      image: product.image,
      size: line.size,
      qty: line.qty,
      unitPrice: product.price,
      lineTotal: product.price * line.qty
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (body.expectedSubtotal !== subtotal) {
    const concurrentOrder = await db.findOrderByIdempotencyKey(customerId, idempotencyKey);
    if (concurrentOrder && concurrentOrder.requestHash === requestHash) {
      return { order: concurrentOrder.order, replayed: true };
    }
    throw requestError("The bag price changed. Review the updated subtotal before confirming your order.", 409);
  }
  return db.createOrder(customer, items, subtotal, customerId, idempotencyKey, requestHash);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === "GET" && pathname === "/api/health") {
    await db.ping();
    return send(res, 200, { ok: true, database: "Neon Postgres" });
  }

  if (req.method === "GET" && pathname === "/api/content") {
    const content = await db.readContent();
    if (!content) return send(res, 503, { error: "The archive has not been initialized." });
    return send(res, 200, content);
  }

  if (req.method === "POST" && pathname === "/api/auth/signup") {
    const body = await readJson(req, 16 * 1024);
    if (!validCustomerCredentials(body, true)) {
      return send(res, 400, { error: "Enter your name, a valid email, and a password of at least 8 characters." });
    }
    const email = normalizeEmail(body.email);
    if (await rateLimitedAuth(req, "customer-signup", email, 5)) {
      return send(res, 429, { error: "Too many account attempts. Try again in 15 minutes." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    try {
      await db.createCustomer(body.name.trim(), email, await derivePassword(body.password, salt), salt);
    } catch (error) {
      if (error.code !== "23505") throw error;
    }
    return send(res, 202, { message: "If a new account was created, sign in with this email and password to continue." });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req, 16 * 1024);
    if (!validCustomerCredentials(body, false)) {
      return send(res, 400, { error: "Enter a valid email and password." });
    }
    const email = normalizeEmail(body.email);
    if (await rateLimitedAuth(req, "customer-login", email)) {
      return send(res, 429, { error: "Too many sign-in attempts. Try again in 15 minutes." });
    }
    const record = await db.findCustomerByEmail(email);
    const passwordIsCorrect = record
      ? await passwordMatches(body.password, record.password_salt, record.password_hash)
      : await passwordMatches(body.password, "00112233445566778899aabbccddeeff", "0".repeat(128));
    if (!record || !passwordIsCorrect) {
      return send(res, 401, { error: "The email or password is not correct." });
    }
    const customer = { id: record.id, name: record.name, email: record.email, createdAt: record.created_at };
    const session = await startCustomerSession(customer);
    return send(res, 200, { customer, orders: await db.readCustomerOrders(customer.id), token: session.token, expiresAt: session.expiresAt });
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const customer = await requireCustomer(req, res);
    if (!customer) return;
    return send(res, 200, { customer, orders: await db.readCustomerOrders(customer.id) });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    await db.deleteCustomerSession(tokenFrom(req));
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/orders") {
    const signedInCustomer = await requireCustomer(req, res);
    if (!signedInCustomer) return;
    const idempotencyKey = normalizeIdempotencyKey(req.headers["idempotency-key"]);
    if (!idempotencyKey) return send(res, 400, { error: "A valid checkout attempt key is required." });
    try {
      const result = await createOrder(await readJson(req, 64 * 1024), signedInCustomer.id, idempotencyKey);
      return send(res, result.replayed ? 200 : 201, { order: result.order, replayed: result.replayed });
    } catch (error) {
      if (error.code === "IDEMPOTENCY_KEY_REUSED") {
        return send(res, 409, { code: error.code, error: error.message });
      }
      throw error;
    }
  }

  const orderAttemptMatch = /^\/api\/orders\/attempt\/([a-f0-9-]{36})$/i.exec(pathname);
  if (req.method === "GET" && orderAttemptMatch) {
    const signedInCustomer = await requireCustomer(req, res);
    if (!signedInCustomer) return;
    const idempotencyKey = normalizeIdempotencyKey(orderAttemptMatch[1]);
    if (!idempotencyKey) return send(res, 400, { error: "Invalid checkout attempt key." });
    const result = await db.findOrderByIdempotencyKey(signedInCustomer.id, idempotencyKey);
    return result ? send(res, 200, { order: result.order }) : send(res, 404, { error: "No order has been recorded for this attempt." });
  }

  const mediaMatch = /^\/api\/media\/([a-f0-9-]{36})$/.exec(pathname);
  if (req.method === "GET" && mediaMatch) {
    const media = await db.readMedia(mediaMatch[1]);
    if (!media) return send(res, 404, { error: "Image not found." });
    return send(res, 200, Buffer.from(media.base64_data, "base64"), media.mime_type,
      "public, max-age=31536000, immutable");
  }

  if (req.method === "GET" && pathname === "/api/admin/setup-status") {
    return send(res, 200, { configured: Boolean(await db.findAdminAccount()) });
  }

  if (req.method === "GET" && pathname === "/api/admin/session") {
    if (!await db.hasSession(tokenFrom(req))) return send(res, 401, { error: "Your studio session has expired. Sign in again." });
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/admin/setup") {
    const studioKey = process.env.QB_ADMIN_KEY || "";
    if (studioKey.length < 16) return send(res, 503, { error: "Studio setup is not configured." });
    const body = await readJson(req, 8192);
    if (!isObject(body) || typeof body.email !== "string" || body.email.length > 254 ||
        typeof body.password !== "string" || body.password.length > 128 ||
        typeof body.confirmPassword !== "string" || body.confirmPassword.length > 128 ||
        typeof body.key !== "string" || body.key.length > 512) {
      return send(res, 400, { error: "Enter a valid email, password, confirmation, and Studio key." });
    }
    const email = normalizeEmail(body.email);
    if (await rateLimitedAuth(req, "admin-setup", email, 5)) {
      return send(res, 429, { error: "Too many Studio setup attempts. Try again in 15 minutes." });
    }
    if (await db.findAdminAccount()) return send(res, 409, { error: "Studio setup is already complete. Sign in instead." });
    if (!validEmail(email) || body.password.length < 12) {
      return send(res, 400, { error: "Use a valid email and a password with at least 12 characters." });
    }
    if (body.password !== body.confirmPassword) return send(res, 400, { error: "The password confirmation does not match." });
    if (!safeEqual(body.key, studioKey)) return send(res, 401, { error: "Studio credentials are not correct." });

    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const passwordHash = await derivePassword(body.password, passwordSalt);
    const account = await db.createAdminAccount(email, passwordHash, passwordSalt);
    if (!account) return send(res, 409, { error: "Studio setup is already complete. Sign in instead." });
    return send(res, 201, await startAdminSession());
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const studioKey = process.env.QB_ADMIN_KEY || "";
    if (studioKey.length < 16) return send(res, 503, { error: "Studio access is not configured." });
    const body = await readJson(req, 4096);
    const validInput = isObject(body) && typeof body.email === "string" && body.email.length <= 254 &&
      typeof body.password === "string" && body.password.length <= 128 &&
      typeof body.key === "string" && body.key.length <= 512;
    if (!validInput) return send(res, 401, { error: "Studio credentials are not correct." });
    if (await rateLimitedAuth(req, "admin-login", body.email, ADMIN_AUTH_MAX_ATTEMPTS)) {
      return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
    }
    const account = await db.findAdminAccount();
    const emailMatches = Boolean(account) && safeEqual(normalizeEmail(body.email), account.email);
    const keyMatches = safeEqual(body.key, studioKey);
    const passwordIsCorrect = await adminPasswordMatches(body.password, account);
    if (!emailMatches || !keyMatches || !passwordIsCorrect) {
      return send(res, 401, { error: "Studio credentials are not correct." });
    }
    return send(res, 200, await startAdminSession());
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    await db.deleteSession(tokenFrom(req));
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/admin/orders") {
    if (!await requireAdmin(req, res)) return;
    return send(res, 200, { orders: await db.readOrders() });
  }

  if (req.method === "GET" && pathname === "/api/admin/customers") {
    if (!await requireAdmin(req, res)) return;
    return send(res, 200, { customers: await db.readCustomers() });
  }

  const customerMatch = /^\/api\/admin\/customers\/([a-f0-9-]{36})$/.exec(pathname);
  if (customerMatch && req.method === "DELETE") {
    if (!await requireAdmin(req, res)) return;
    const removed = await db.deleteCustomer(customerMatch[1]);
    return removed ? send(res, 200, { ok: true, email: removed.email }) :
      send(res, 404, { error: "Customer not found." });
  }

  const orderMatch = /^\/api\/admin\/orders\/([a-f0-9-]{36})$/.exec(pathname);
  if (orderMatch && req.method === "DELETE") {
    if (!await requireAdmin(req, res)) return;
    const removed = await db.deleteOrder(orderMatch[1]);
    return removed ? send(res, 200, { ok: true, orderNumber: removed.order_number }) :
      send(res, 404, { error: "Order not found." });
  }

  if (orderMatch && req.method === "PATCH") {
    if (!await requireAdmin(req, res)) return;
    return send(res, 409, { error: "This test order has no verified payment, so its order and fulfillment states cannot be advanced." });
  }

  if (req.method === "PUT" && pathname === "/api/admin/content") {
    if (!await requireAdmin(req, res)) return;
    const body = await readJson(req, 1024 * 1024);
    if (!Number.isSafeInteger(body.contentVersion) || body.contentVersion < 1) {
      return send(res, 428, { error: "Reload Studio before saving so the latest archive version is protected." });
    }
    if (!validContent(body)) {
      return send(res, 400, { error: "Check required fields and unique Series and Chapter slugs. Products need a name, description, image, positive price, at least one size and detail, and a valid chapter link." });
    }
    let contentVersion;
    try {
      contentVersion = await db.writeContent(body, body.contentVersion);
    } catch (error) {
      if (error.code === "CONTENT_VERSION_CONFLICT") {
        return send(res, 409, { error: error.message, code: error.code });
      }
      throw error;
    }
    try {
      await db.pruneUnusedMedia();
    } catch (error) {
      // A cleanup failure must not make an already-committed content save look
      // like it failed; unused assets can be pruned on the next successful save.
      console.error("Unused media cleanup failed:", error);
    }
    return send(res, 200, { ok: true, contentVersion, savedAt: new Date().toISOString() });
  }

  if (req.method === "POST" && pathname === "/api/admin/upload") {
    if (!await requireAdmin(req, res)) return;
    const body = await readJson(req, 3 * 1024 * 1024);
    const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(body.data || "");
    if (!match) return send(res, 400, { error: "Choose a PNG, JPG, or WebP image." });
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      return send(res, 413, { error: "Images must be 2 MB or smaller." });
    }
    const mime = "image/" + match[1];
    if (!validImageBytes(mime, bytes)) {
      return send(res, 400, { error: "The image contents do not match its file type." });
    }
    const mediaUrl = await db.saveMedia(mime, bytes);
    return send(res, 201, { url: mediaUrl });
  }

  if (pathname.startsWith("/api/")) return send(res, 404, { error: "Not found." });
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 404, { error: "Not found." });

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, "." + requested);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, { error: "Not allowed." });
  try {
    const data = await fs.promises.readFile(filePath);
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, headers(type, type.startsWith("image/") ? "public, max-age=3600" : "no-store"));
    return res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    if (!path.extname(pathname) && !pathname.startsWith("/assets/") && !pathname.startsWith("/uploads/")) {
      const index = await fs.promises.readFile(path.join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, headers("text/html; charset=utf-8"));
      return res.end(req.method === "HEAD" ? undefined : index);
    }
    return send(res, 404, "Not found.", "text/plain; charset=utf-8");
  }
}

function onRequest(req, res) {
  handle(req, res).catch((error) => {
    if (!res.headersSent) {
      const status = error.status || (error.code === "23505" ? 400 : 500);
      const message = status === 500 ? "The service could not complete that request." :
        status === 400 && error.code === "23505" ? "Chapter and product slugs must be unique." : error.message;
      if (status === 500) console.error("Request failed:", error);
      send(res, status, { error: message });
    } else {
      res.destroy();
    }
  });
}

if (require.main === module) {
  http.createServer(onRequest).listen(PORT, "127.0.0.1", () => {
    console.log("QUIET BATTLES running at http://127.0.0.1:" + PORT);
  });
}

module.exports = onRequest;
