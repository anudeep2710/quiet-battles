const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data", "content.json");
const DB_FILE = path.join(ROOT, "data", "quiet-battles.sqlite");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const PORT = Number(process.env.PORT || 4173);
const ADMIN_KEY = process.env.QB_ADMIN_KEY || "quietbattles-demo";
const sessions = new Map();

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const database = new DatabaseSync(DB_FILE);
database.exec(
  "PRAGMA foreign_keys = ON;" +
  "CREATE TABLE IF NOT EXISTS site_settings (" +
    "id INTEGER PRIMARY KEY CHECK (id = 1)," +
    "brand TEXT NOT NULL," +
    "hero TEXT NOT NULL," +
    "introduction TEXT NOT NULL," +
    "series TEXT NOT NULL," +
    "updated_at TEXT NOT NULL" +
  ");" +
  "CREATE TABLE IF NOT EXISTS chapters (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "sort_order INTEGER NOT NULL UNIQUE," +
    "number TEXT NOT NULL," +
    "slug TEXT NOT NULL UNIQUE," +
    "title TEXT NOT NULL," +
    "excerpt TEXT NOT NULL," +
    "image TEXT NOT NULL," +
    "product_slug TEXT NOT NULL," +
    "story TEXT NOT NULL" +
  ");" +
  "CREATE TABLE IF NOT EXISTS products (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "sort_order INTEGER NOT NULL UNIQUE," +
    "slug TEXT NOT NULL UNIQUE," +
    "name TEXT NOT NULL," +
    "category TEXT NOT NULL," +
    "description TEXT NOT NULL," +
    "price INTEGER NOT NULL CHECK (price >= 0)," +
    "image TEXT NOT NULL," +
    "sizes TEXT NOT NULL," +
    "details TEXT NOT NULL," +
    "chapter_slug TEXT NOT NULL" +
  ");"
);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(Object.assign(new Error("Request is too large."), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(Object.assign(new Error("Send valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function getSession(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return token;
}

function requireAdmin(req, res) {
  if (getSession(req)) return true;
  send(res, 401, { error: "Your studio session has expired. Sign in again." });
  return false;
}

function isValidContent(value) {
  return value && typeof value === "object" &&
    value.brand && typeof value.brand.tagline === "string" &&
    value.hero && typeof value.hero.title === "string" &&
    value.series && Array.isArray(value.series.chapters) &&
    Array.isArray(value.products) && value.products.length > 0;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function readContent() {
  const settings = database.prepare(
    "SELECT brand, hero, introduction, series FROM site_settings WHERE id = 1"
  ).get();
  if (!settings) return null;
  const series = JSON.parse(settings.series);
  const chapters = database.prepare(
    "SELECT number, slug, title, excerpt, image, product_slug, story FROM chapters ORDER BY sort_order"
  ).all().map((row) => ({
    number: row.number,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    image: row.image,
    productSlug: row.product_slug,
    story: JSON.parse(row.story),
  }));
  const products = database.prepare(
    "SELECT slug, name, category, description, price, image, sizes, details, chapter_slug FROM products ORDER BY sort_order"
  ).all().map((row) => ({
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    image: row.image,
    sizes: JSON.parse(row.sizes),
    details: JSON.parse(row.details),
    chapterSlug: row.chapter_slug,
  }));
  return {
    brand: JSON.parse(settings.brand),
    hero: JSON.parse(settings.hero),
    introduction: JSON.parse(settings.introduction),
    series: { ...series, chapters },
    products,
  };
}

function writeContent(value) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare(
      "INSERT INTO site_settings (id, brand, hero, introduction, series, updated_at) " +
      "VALUES (1, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET brand = excluded.brand, hero = excluded.hero, " +
      "introduction = excluded.introduction, series = excluded.series, updated_at = excluded.updated_at"
    ).run(
      JSON.stringify(value.brand),
      JSON.stringify(value.hero),
      JSON.stringify(value.introduction),
      JSON.stringify({
        number: value.series.number,
        title: value.series.title,
        subtitle: value.series.subtitle,
        description: value.series.description,
        image: value.series.image,
      }),
      new Date().toISOString()
    );

    database.exec("DELETE FROM chapters; DELETE FROM products;");
    const insertChapter = database.prepare(
      "INSERT INTO chapters (sort_order, number, slug, title, excerpt, image, product_slug, story) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    value.series.chapters.forEach((chapter, index) => {
      insertChapter.run(
        index, chapter.number || "", chapter.slug || "", chapter.title || "",
        chapter.excerpt || "", chapter.image || "", chapter.productSlug || "",
        JSON.stringify(Array.isArray(chapter.story) ? chapter.story : [])
      );
    });

    const insertProduct = database.prepare(
      "INSERT INTO products (sort_order, slug, name, category, description, price, image, sizes, details, chapter_slug) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    value.products.forEach((product, index) => {
      insertProduct.run(
        index, product.slug || "", product.name || "", product.category || "",
        product.description || "", Number(product.price || 0), product.image || "",
        JSON.stringify(Array.isArray(product.sizes) ? product.sizes : []),
        JSON.stringify(Array.isArray(product.details) ? product.details : []),
        product.chapterSlug || ""
      );
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === "GET" && pathname === "/api/health") {
    return send(res, 200, { ok: true, service: "quiet-battles-demo" });
  }

  if (req.method === "GET" && pathname === "/api/content") {
    const content = readContent();
    return send(res, 200, content);
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const body = await readJson(req, 4096);
    if (!safeEqual(body.key || "", ADMIN_KEY)) {
      return send(res, 401, { error: "That studio key is not correct." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { expiresAt: Date.now() + 4 * 60 * 60 * 1000 });
    return send(res, 200, { token, expiresIn: 14400 });
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    const token = getSession(req);
    if (token) sessions.delete(token);
    return send(res, 200, { ok: true });
  }

  if (req.method === "PUT" && pathname === "/api/admin/content") {
    if (!requireAdmin(req, res)) return;
    const body = await readJson(req);
    if (!isValidContent(body)) {
      return send(res, 400, { error: "The content is missing a series, chapters, or products." });
    }
    try {
      writeContent(body);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return send(res, 400, { error: "Chapter and product slugs must be unique." });
      }
      throw error;
    }
    return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
  }

  if (req.method === "POST" && pathname === "/api/admin/upload") {
    if (!requireAdmin(req, res)) return;
    const body = await readJson(req, 8 * 1024 * 1024);
    const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(body.data || "");
    if (!match) return send(res, 400, { error: "Choose a PNG, JPG, or WebP image." });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 5 * 1024 * 1024) {
      return send(res, 413, { error: "Images must be 5 MB or smaller." });
    }
    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    const filename = crypto.randomUUID() + "." + extension;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), bytes, { flag: "wx" });
    return send(res, 201, { url: "/uploads/" + filename });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 404, { error: "Not found." });
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, "." + requested);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return send(res, 403, { error: "Not allowed." });
  }
  try {
    const data = await fs.promises.readFile(filePath);
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Cache-Control": type.startsWith("image/") ? "public, max-age=3600" : "no-store",
    });
    return res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    return send(res, 404, "Not found.", "text/plain; charset=utf-8");
  }
}

if (!database.prepare("SELECT 1 FROM site_settings WHERE id = 1").get()) {
  const seed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  writeContent(seed);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!res.headersSent) {
      send(res, error.status || 500, { error: error.status ? error.message : "The demo server could not complete that request." });
    } else {
      res.destroy();
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("QUIET BATTLES demo running at http://127.0.0.1:" + PORT);
});
