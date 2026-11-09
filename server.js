"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const db = require("./db");

const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 4173);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ORDER_STATUSES = new Set(["Placed", "Confirmed", "Packed", "Shipped", "Completed", "Cancelled"]);
const CUSTOMER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_AUTH_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_AUTH_MAX_ATTEMPTS = 10;
const adminAuthAttempts = new Map();
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

function derivePassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function passwordMatches(password, salt, expected) {
  const actual = Buffer.from(derivePassword(password, salt), "hex");
  const stored = Buffer.from(String(expected || ""), "hex");
  return actual.length === stored.length && crypto.timingSafeEqual(actual, stored);
}

function adminPasswordMatches(password, account) {
  if (!account || !/^[a-f0-9]{128}$/.test(account.password_hash || "") ||
      !/^[a-f0-9]{32}$/.test(account.password_salt || "")) return false;
  return passwordMatches(password, account.password_salt, account.password_hash);
}

function rateLimitedAdminAuth(req, scope) {
  const now = Date.now();
  const address = String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown").slice(0, 128);
  const key = scope + ":" + address;
  let attempt = adminAuthAttempts.get(key);
  if (!attempt || now - attempt.startedAt >= ADMIN_AUTH_WINDOW_MS) {
    attempt = { startedAt: now, count: 0 };
  }
  if (attempt.count >= ADMIN_AUTH_MAX_ATTEMPTS) {
    adminAuthAttempts.set(key, attempt);
    return true;
  }
  attempt.count += 1;
  adminAuthAttempts.set(key, attempt);
  if (adminAuthAttempts.size > 500) {
    for (const [entryKey, entry] of adminAuthAttempts) {
      if (now - entry.startedAt >= ADMIN_AUTH_WINDOW_MS) adminAuthAttempts.delete(entryKey);
    }
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
    if (!isObject(product) || !["name", "kind", "category", "description", "chapterSlug"].every((k) => validText(product[k])) ||
        !product.kind.trim() || product.kind.length > 40 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug || "") ||
        productSlugs.has(product.slug) || !validImage(product.image) ||
        (product.secondaryImage && !validImage(product.secondaryImage)) ||
        !Number.isInteger(product.price) || product.price < 0 || product.price > 10000000 ||
        !Array.isArray(product.sizes) || product.sizes.length < 1 || product.sizes.length > 30 ||
        !product.sizes.every((item) => validText(item, 30)) ||
        !Array.isArray(product.details) || product.details.length > 30 ||
        !product.details.every((item) => validText(item, 300)) ||
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

async function createOrder(body, customerId) {
  if (!validOrderRequest(body)) throw requestError("Check the customer details, bag items, and no-payment acknowledgement.");
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
    throw requestError("The bag price changed. Review the updated subtotal before confirming your order.", 409);
  }
  const customer = {
    name: body.customer.name.trim(),
    email: body.customer.email.trim().toLowerCase(),
    phone: body.customer.phone.trim(),
    address: body.customer.address.trim(),
    city: body.customer.city.trim(),
    postalCode: body.customer.postalCode.trim()
  };
  return db.createOrder(customer, items, subtotal, customerId);
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
    if (await db.findCustomerByEmail(email)) {
      return send(res, 409, { error: "An archive already exists for that email. Sign in instead." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    let customer;
    try {
      customer = await db.createCustomer(body.name.trim(), email, derivePassword(body.password, salt), salt);
    } catch (error) {
      if (error.code === "23505") return send(res, 409, { error: "An archive already exists for that email. Sign in instead." });
      throw error;
    }
    const session = await startCustomerSession(customer);
    return send(res, 201, { customer, orders: [], token: session.token, expiresAt: session.expiresAt });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req, 16 * 1024);
    if (!validCustomerCredentials(body, false)) {
      return send(res, 400, { error: "Enter a valid email and password." });
    }
    const record = await db.findCustomerByEmail(normalizeEmail(body.email));
    if (!record || !passwordMatches(body.password, record.password_salt, record.password_hash)) {
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
    const order = await createOrder(await readJson(req, 64 * 1024), signedInCustomer.id);
    return send(res, 201, { order });
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
    if (rateLimitedAdminAuth(req, "setup")) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
    const studioKey = process.env.QB_ADMIN_KEY || "";
    if (studioKey.length < 16) return send(res, 503, { error: "Studio setup is not configured." });
    if (await db.findAdminAccount()) return send(res, 409, { error: "Studio setup is already complete. Sign in instead." });
    const body = await readJson(req, 8192);
    if (!isObject(body) || typeof body.email !== "string" || body.email.length > 254 ||
        typeof body.password !== "string" || body.password.length > 128 ||
        typeof body.confirmPassword !== "string" || body.confirmPassword.length > 128 ||
        typeof body.key !== "string" || body.key.length > 512) {
      return send(res, 400, { error: "Enter a valid email, password, confirmation, and Studio key." });
    }
    const email = normalizeEmail(body.email);
    if (!validEmail(email) || body.password.length < 12) {
      return send(res, 400, { error: "Use a valid email and a password with at least 12 characters." });
    }
    if (body.password !== body.confirmPassword) return send(res, 400, { error: "The password confirmation does not match." });
    if (!safeEqual(body.key, studioKey)) return send(res, 401, { error: "Studio credentials are not correct." });

    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.scryptSync(body.password, passwordSalt, 64).toString("hex");
    const account = await db.createAdminAccount(email, passwordHash, passwordSalt);
    if (!account) return send(res, 409, { error: "Studio setup is already complete. Sign in instead." });
    return send(res, 201, await startAdminSession());
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    if (rateLimitedAdminAuth(req, "login")) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
    const studioKey = process.env.QB_ADMIN_KEY || "";
    if (studioKey.length < 16) return send(res, 503, { error: "Studio access is not configured." });
    const body = await readJson(req, 4096);
    const validInput = isObject(body) && typeof body.email === "string" && body.email.length <= 254 &&
      typeof body.password === "string" && body.password.length <= 128 &&
      typeof body.key === "string" && body.key.length <= 512;
    if (!validInput) return send(res, 401, { error: "Studio credentials are not correct." });
    const account = await db.findAdminAccount();
    const emailMatches = Boolean(account) && safeEqual(normalizeEmail(body.email), account.email);
    const keyMatches = safeEqual(body.key, studioKey);
    const passwordIsCorrect = adminPasswordMatches(body.password, account);
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
  if (orderMatch && req.method === "PATCH") {
    if (!await requireAdmin(req, res)) return;
    const body = await readJson(req, 4096);
    if (!ORDER_STATUSES.has(body.status)) return send(res, 400, { error: "Choose a valid order status." });
    const order = await db.updateOrderStatus(orderMatch[1], body.status);
    return order ? send(res, 200, { order }) : send(res, 404, { error: "Order not found." });
  }

  if (orderMatch && req.method === "DELETE") {
    if (!await requireAdmin(req, res)) return;
    const removed = await db.deleteOrder(orderMatch[1]);
    return removed ? send(res, 200, { ok: true, orderNumber: removed.order_number }) :
      send(res, 404, { error: "Order not found." });
  }

  if (req.method === "PUT" && pathname === "/api/admin/content") {
    if (!await requireAdmin(req, res)) return;
    const body = await readJson(req, 1024 * 1024);
    if (!validContent(body)) {
      return send(res, 400, { error: "Check required fields, unique Series and Chapter slugs, linked products, and image URLs." });
    }
    await db.writeContent(body);
    try {
      await db.pruneUnusedMedia();
    } catch (error) {
      // A cleanup failure must not make an already-committed content save look
      // like it failed; unused assets can be pruned on the next successful save.
      console.error("Unused media cleanup failed:", error);
    }
    return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
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
