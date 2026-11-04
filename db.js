"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { neon, neonConfig } = require("@neondatabase/serverless");

// The regional api.* host did not resolve for this Neon region. Its endpoint host
// serves the same SQL-over-HTTPS route, so send HTTP queries there directly.
neonConfig.fetchEndpoint = (host) => "https://" + host + "/sql";

let client;
function getClient() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Connect a Neon database first.");
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}

const schema = [
  "CREATE TABLE IF NOT EXISTS site_settings (id SMALLINT PRIMARY KEY CHECK (id = 1), brand JSONB NOT NULL, hero JSONB NOT NULL, introduction JSONB NOT NULL, series JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS chapters (sort_order INTEGER PRIMARY KEY, number TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT NOT NULL, image TEXT NOT NULL, product_slug TEXT NOT NULL, story JSONB NOT NULL)",
  "CREATE TABLE IF NOT EXISTS products (sort_order INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL CHECK (price >= 0), image TEXT NOT NULL, sizes JSONB NOT NULL, details JSONB NOT NULL, chapter_slug TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS media_assets (id UUID PRIMARY KEY, mime_type TEXT NOT NULL, base64_data TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL)"
];

async function initializeDatabase() {
  const sql = getClient();
  for (const statement of schema) await sql.query(statement);
  const rows = await sql.query("SELECT 1 FROM site_settings WHERE id = 1");
  if (!rows.length) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "content.json"), "utf8"));
    await writeContent(seed);
  }
}

async function readContent() {
  const sql = getClient();
  const [settingsRows, chapterRows, productRows] = await sql.transaction([
    sql.query("SELECT brand, hero, introduction, series FROM site_settings WHERE id = 1"),
    sql.query("SELECT number, slug, title, excerpt, image, product_slug, story FROM chapters ORDER BY sort_order"),
    sql.query("SELECT slug, name, category, description, price, image, sizes, details, chapter_slug FROM products ORDER BY sort_order")
  ], { readOnly: true });
  const settings = settingsRows[0];
  if (!settings) return null;
  return {
    brand: settings.brand,
    hero: settings.hero,
    introduction: settings.introduction,
    series: {
      ...settings.series,
      chapters: chapterRows.map((row) => ({
        number: row.number, slug: row.slug, title: row.title, excerpt: row.excerpt,
        image: row.image, productSlug: row.product_slug, story: row.story
      }))
    },
    products: productRows.map((row) => ({
      slug: row.slug, name: row.name, category: row.category,
      description: row.description, price: row.price, image: row.image,
      sizes: row.sizes, details: row.details, chapterSlug: row.chapter_slug
    }))
  };
}

async function writeContent(value) {
  const sql = getClient();
  const series = {
    number: value.series.number,
    title: value.series.title,
    subtitle: value.series.subtitle,
    description: value.series.description,
    image: value.series.image
  };
  const queries = [
    sql.query(
      "INSERT INTO site_settings (id, brand, hero, introduction, series, updated_at) VALUES (1, $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb, now()) ON CONFLICT (id) DO UPDATE SET brand = EXCLUDED.brand, hero = EXCLUDED.hero, introduction = EXCLUDED.introduction, series = EXCLUDED.series, updated_at = now()",
      [JSON.stringify(value.brand), JSON.stringify(value.hero), JSON.stringify(value.introduction), JSON.stringify(series)]
    ),
    sql.query("DELETE FROM chapters"),
    sql.query("DELETE FROM products")
  ];
  value.series.chapters.forEach((chapter, index) => {
    queries.push(sql.query(
      "INSERT INTO chapters (sort_order, number, slug, title, excerpt, image, product_slug, story) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      [index, chapter.number, chapter.slug, chapter.title, chapter.excerpt, chapter.image, chapter.productSlug, JSON.stringify(chapter.story)]
    ));
  });
  value.products.forEach((product, index) => {
    queries.push(sql.query(
      "INSERT INTO products (sort_order, slug, name, category, description, price, image, sizes, details, chapter_slug) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)",
      [index, product.slug, product.name, product.category, product.description, product.price, product.image, JSON.stringify(product.sizes), JSON.stringify(product.details), product.chapterSlug]
    ));
  });
  await sql.transaction(queries);
}

async function saveMedia(mimeType, bytes) {
  const id = crypto.randomUUID();
  await getClient().query(
    "INSERT INTO media_assets (id, mime_type, base64_data) VALUES ($1::uuid, $2, $3)",
    [id, mimeType, bytes.toString("base64")]
  );
  return "/api/media/" + id;
}

async function readMedia(id) {
  const rows = await getClient().query(
    "SELECT mime_type, base64_data FROM media_assets WHERE id = $1::uuid",
    [id]
  );
  return rows[0] || null;
}

async function createSession(token, expiresAt) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const sql = getClient();
  await sql.transaction([
    sql.query("DELETE FROM admin_sessions WHERE expires_at < now()"),
    sql.query("INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)", [hash, expiresAt.toISOString()])
  ]);
}

async function hasSession(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const rows = await getClient().query(
    "SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()",
    [hash]
  );
  return rows.length > 0;
}

async function deleteSession(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await getClient().query("DELETE FROM admin_sessions WHERE token_hash = $1", [hash]);
}

async function ping() {
  await getClient().query("SELECT 1");
}

module.exports = {
  initializeDatabase, readContent, writeContent, saveMedia, readMedia,
  createSession, hasSession, deleteSession, ping
};
