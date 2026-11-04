"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const db = require("./db");

const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 4173);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validText(value, max = 2000) {
  return typeof value === "string" && value.length <= max;
}

function validImage(value) {
  if (!validText(value, 2048)) return false;
  return /^https:\/\/[^<>"'\s]+$/.test(value) ||
    /^\/assets\/[a-zA-Z0-9._/-]+$/.test(value) ||
    /^\/api\/media\/[a-f0-9-]{36}$/.test(value);
}

function validContent(value) {
  if (!isObject(value) || !isObject(value.brand) || !isObject(value.hero) ||
      !isObject(value.introduction) || !isObject(value.series) ||
      !Array.isArray(value.series.chapters) || !Array.isArray(value.products)) return false;
  if (value.series.chapters.length < 1 || value.series.chapters.length > 30 ||
      value.products.length < 1 || value.products.length > 100) return false;
  if (!["name", "tagline", "intro"].every((k) => validText(value.brand[k])) ||
      !["eyebrow", "title", "description"].every((k) => validText(value.hero[k])) ||
      !validImage(value.hero.image) ||
      !["eyebrow", "title", "copy"].every((k) => validText(value.introduction[k])) ||
      !["number", "title", "subtitle", "description"].every((k) => validText(value.series[k])) ||
      !validImage(value.series.image)) return false;
  const chapterSlugs = new Set();
  for (const chapter of value.series.chapters) {
    if (!isObject(chapter) || !["number", "title", "excerpt", "productSlug"].every((k) => validText(chapter[k])) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter.slug || "") ||
        chapterSlugs.has(chapter.slug) || !validImage(chapter.image) ||
        !Array.isArray(chapter.story) || chapter.story.length > 30 ||
        !chapter.story.every((item) => validText(item, 5000))) return false;
    chapterSlugs.add(chapter.slug);
  }
  const productSlugs = new Set();
  for (const product of value.products) {
    if (!isObject(product) || !["name", "category", "description", "chapterSlug"].every((k) => validText(product[k])) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug || "") ||
        productSlugs.has(product.slug) || !validImage(product.image) ||
        !Number.isInteger(product.price) || product.price < 0 || product.price > 10000000 ||
        !Array.isArray(product.sizes) || product.sizes.length < 1 || product.sizes.length > 30 ||
        !product.sizes.every((item) => validText(item, 30)) ||
        !Array.isArray(product.details) || product.details.length > 30 ||
        !product.details.every((item) => validText(item, 300)) ||
        !chapterSlugs.has(product.chapterSlug)) return false;
    productSlugs.add(product.slug);
  }
  return value.series.chapters.every((chapter) => productSlugs.has(chapter.productSlug));
}

function validImageBytes(mime, bytes) {
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mime === "image/jpeg") return bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  if (mime === "image/webp") return bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP";
  return false;
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

  const mediaMatch = /^\/api\/media\/([a-f0-9-]{36})$/.exec(pathname);
  if (req.method === "GET" && mediaMatch) {
    const media = await db.readMedia(mediaMatch[1]);
    if (!media) return send(res, 404, { error: "Image not found." });
    return send(res, 200, Buffer.from(media.base64_data, "base64"), media.mime_type,
      "public, max-age=31536000, immutable");
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    if (!process.env.QB_ADMIN_KEY || process.env.QB_ADMIN_KEY.length < 16) {
      return send(res, 503, { error: "Studio access is not configured." });
    }
    const body = await readJson(req, 4096);
    if (!safeEqual(body.key || "", process.env.QB_ADMIN_KEY)) {
      return send(res, 401, { error: "That studio key is not correct." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await db.createSession(token, expiresAt);
    return send(res, 200, { token, expiresIn: 14400 });
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    await db.deleteSession(tokenFrom(req));
    return send(res, 200, { ok: true });
  }

  if (req.method === "PUT" && pathname === "/api/admin/content") {
    if (!await requireAdmin(req, res)) return;
    const body = await readJson(req, 1024 * 1024);
    if (!validContent(body)) {
      return send(res, 400, { error: "Check required fields, unique slugs, linked items, and image URLs." });
    }
    await db.writeContent(body);
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
    console.log("QUIET BATTLES demo running at http://127.0.0.1:" + PORT);
  });
}

module.exports = onRequest;
