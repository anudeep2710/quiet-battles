"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { neon, neonConfig } = require("@neondatabase/serverless");

// The regional api.* host did not resolve for this Neon region. Its endpoint host
// serves the same SQL-over-HTTPS route, so send HTTP queries there directly.
neonConfig.fetchEndpoint = (host) => "https://" + host + "/sql";
neonConfig.fetchFunction = async (input, init) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (!["ENOTFOUND", "EAI_AGAIN"].includes(error.cause?.code) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
};

let client;
function getClient() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Connect a Neon database first.");
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}

const schema = [
  "CREATE TABLE IF NOT EXISTS site_settings (id SMALLINT PRIMARY KEY CHECK (id = 1), brand JSONB NOT NULL, hero JSONB NOT NULL, introduction JSONB NOT NULL, series JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS series (sort_order INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, number TEXT NOT NULL, title TEXT NOT NULL, subtitle TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS chapters (sort_order INTEGER PRIMARY KEY, series_slug TEXT NOT NULL DEFAULT 'the-gentle-armor', number TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT NOT NULL, image TEXT NOT NULL, product_slug TEXT NOT NULL, story JSONB NOT NULL)",
  "ALTER TABLE chapters ADD COLUMN IF NOT EXISTS series_slug TEXT NOT NULL DEFAULT 'the-gentle-armor'",
  "CREATE TABLE IF NOT EXISTS products (sort_order INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Layers', category TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL CHECK (price >= 0), image TEXT NOT NULL, secondary_image TEXT NOT NULL DEFAULT '', sizes JSONB NOT NULL, details JSONB NOT NULL, chapter_slug TEXT NOT NULL)",
  "ALTER TABLE products ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'Layers'",
  "ALTER TABLE products ADD COLUMN IF NOT EXISTS secondary_image TEXT NOT NULL DEFAULT ''",
  "CREATE TABLE IF NOT EXISTS media_assets (id UUID PRIMARY KEY, mime_type TEXT NOT NULL, base64_data TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL)",
  "CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  "CREATE TABLE IF NOT EXISTS customer_sessions (token_hash TEXT PRIMARY KEY, customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL)",
  "CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, customer JSONB NOT NULL, items JSONB NOT NULL, subtotal INTEGER NOT NULL CHECK (subtotal >= 0), payment_method TEXT NOT NULL DEFAULT 'test_qr', payment_status TEXT NOT NULL DEFAULT 'Not paid', status TEXT NOT NULL DEFAULT 'Placed', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL",
  "CREATE INDEX IF NOT EXISTS orders_customer_id_created_at_idx ON orders (customer_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC)"
];

async function initializeDatabase() {
  const sql = getClient();
  for (const statement of schema) await sql.query(statement);
  const rows = await sql.query("SELECT series FROM site_settings WHERE id = 1");
  if (!rows.length) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "content.json"), "utf8"));
    await writeContent(seed);
  } else {
    const seriesRows = await sql.query("SELECT 1 FROM series LIMIT 1");
    if (!seriesRows.length) {
      const legacy = rows[0].series;
      await sql.query(
        "INSERT INTO series (sort_order, slug, number, title, subtitle, description, image) VALUES (0, $1, $2, $3, $4, $5, $6)",
        [legacy.slug || "the-gentle-armor", legacy.number, legacy.title, legacy.subtitle, legacy.description, legacy.image]
      );
    }
  }
}

async function readContent() {
  const sql = getClient();
  const [settingsRows, seriesRows, chapterRows, productRows] = await sql.transaction([
    sql.query("SELECT brand, hero, introduction, series FROM site_settings WHERE id = 1"),
    sql.query("SELECT slug, number, title, subtitle, description, image FROM series ORDER BY sort_order"),
    sql.query("SELECT series_slug, number, slug, title, excerpt, image, product_slug, story FROM chapters ORDER BY sort_order"),
    sql.query("SELECT slug, name, kind, category, description, price, image, secondary_image, sizes, details, chapter_slug FROM products ORDER BY sort_order")
  ], { readOnly: true });
  const settings = settingsRows[0];
  if (!settings) return null;
  const seriesList = (seriesRows.length ? seriesRows : [{ ...settings.series, slug: "the-gentle-armor" }]).map((series) => ({
    slug: series.slug,
    number: series.number,
    title: series.title,
    subtitle: series.subtitle,
    description: series.description,
    image: series.image,
    chapters: chapterRows.filter((row) => row.series_slug === series.slug).map((row) => ({
      number: row.number, slug: row.slug, title: row.title, excerpt: row.excerpt,
      image: row.image, productSlug: row.product_slug, story: row.story
    }))
  }));
  return {
    brand: settings.brand,
    hero: settings.hero,
    introduction: settings.introduction,
    seriesList,
    products: productRows.map((row) => ({
      slug: row.slug, name: row.name, kind: row.kind, category: row.category,
      description: row.description, price: row.price, image: row.image,
      secondaryImage: row.secondary_image,
      sizes: row.sizes, details: row.details, chapterSlug: row.chapter_slug
    }))
  };
}

async function writeContent(value) {
  const sql = getClient();
  const featured = value.seriesList[0];
  const series = {
    slug: featured.slug, number: featured.number, title: featured.title,
    subtitle: featured.subtitle, description: featured.description, image: featured.image
  };
  const queries = [
    sql.query(
      "INSERT INTO site_settings (id, brand, hero, introduction, series, updated_at) VALUES (1, $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb, now()) ON CONFLICT (id) DO UPDATE SET brand = EXCLUDED.brand, hero = EXCLUDED.hero, introduction = EXCLUDED.introduction, series = EXCLUDED.series, updated_at = now()",
      [JSON.stringify(value.brand), JSON.stringify(value.hero), JSON.stringify(value.introduction), JSON.stringify(series)]
    ),
    sql.query("DELETE FROM chapters"),
    sql.query("DELETE FROM products"),
    sql.query("DELETE FROM series")
  ];
  let chapterOrder = 0;
  value.seriesList.forEach((item, seriesOrder) => {
    queries.push(sql.query(
      "INSERT INTO series (sort_order, slug, number, title, subtitle, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [seriesOrder, item.slug, item.number, item.title, item.subtitle, item.description, item.image]
    ));
    item.chapters.forEach((chapter) => {
      queries.push(sql.query(
        "INSERT INTO chapters (sort_order, series_slug, number, slug, title, excerpt, image, product_slug, story) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)",
        [chapterOrder++, item.slug, chapter.number, chapter.slug, chapter.title, chapter.excerpt, chapter.image, chapter.productSlug, JSON.stringify(chapter.story)]
      ));
    });
  });
  value.products.forEach((product, index) => {
    queries.push(sql.query(
      "INSERT INTO products (sort_order, slug, name, kind, category, description, price, image, secondary_image, sizes, details, chapter_slug) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)",
      [index, product.slug, product.name, product.kind, product.category, product.description, product.price, product.image, product.secondaryImage || "", JSON.stringify(product.sizes), JSON.stringify(product.details), product.chapterSlug]
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

async function pruneUnusedMedia() {
  // Keep every image referenced by published content or an order snapshot so
  // old customer and Studio order records continue to render after edits.
  await getClient().query(`
    WITH referenced_urls(url) AS (
      SELECT hero->>'image' FROM site_settings WHERE id = 1
      UNION ALL
      SELECT series->>'image' FROM site_settings WHERE id = 1
      UNION ALL SELECT image FROM series
      UNION ALL SELECT image FROM chapters
      UNION ALL SELECT image FROM products
      UNION ALL SELECT secondary_image FROM products WHERE secondary_image <> ''
      UNION ALL
      SELECT item->>'image'
      FROM orders
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(orders.items) = 'array' THEN orders.items ELSE '[]'::jsonb END
      ) AS order_item(item)
    )
    DELETE FROM media_assets AS media
    WHERE NOT EXISTS (
      SELECT 1 FROM referenced_urls
      WHERE referenced_urls.url = '/api/media/' || media.id::text
    )
  `);
}

async function readMedia(id) {
  const rows = await getClient().query(
    "SELECT mime_type, base64_data FROM media_assets WHERE id = $1::uuid",
    [id]
  );
  return rows[0] || null;
}

function adminSessionHash(token) {
  const credentials = [process.env.QB_ADMIN_KEY || "", process.env.QB_ADMIN_EMAIL || "",
    process.env.QB_ADMIN_PASSWORD_HASH || ""].join("\0");
  return crypto.createHmac("sha256", credentials).update(token).digest("hex");
}

async function createSession(token, expiresAt) {
  const hash = adminSessionHash(token);
  const sql = getClient();
  await sql.transaction([
    sql.query("DELETE FROM admin_sessions WHERE expires_at < now()"),
    sql.query("INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)", [hash, expiresAt.toISOString()])
  ]);
}

async function hasSession(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const hash = adminSessionHash(token);
  const rows = await getClient().query(
    "SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()",
    [hash]
  );
  return rows.length > 0;
}

async function deleteSession(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const hash = adminSessionHash(token);
  await getClient().query("DELETE FROM admin_sessions WHERE token_hash = $1", [hash]);
}

async function createOrder(customer, items, subtotal, customerId) {
  const id = crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const orderNumber = "QB-" + date + "-" + suffix;
  const rows = await getClient().query(
    "INSERT INTO orders (id, order_number, customer_id, customer, items, subtotal, payment_method, payment_status) VALUES ($1::uuid, $2, $3::uuid, $4::jsonb, $5::jsonb, $6, 'test_qr', 'Not paid') RETURNING id, order_number, customer_id, customer, items, subtotal, payment_method, payment_status, status, created_at, updated_at",
    [id, orderNumber, customerId || null, JSON.stringify(customer), JSON.stringify(items), subtotal]
  );
  return mapOrder(rows[0]);
}

function mapOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id || null,
    customer: row.customer,
    items: row.items,
    subtotal: row.subtotal,
    paymentMethod: row.payment_method === "demo_qr" ? "test_qr" : row.payment_method,
    paymentStatus: row.payment_status === "Demo confirmed" ? "Not paid" : row.payment_status,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function readOrders() {
  const rows = await getClient().query(
    "SELECT id, order_number, customer_id, customer, items, subtotal, payment_method, payment_status, status, created_at, updated_at FROM orders ORDER BY created_at DESC LIMIT 250"
  );
  return rows.map(mapOrder);
}

async function updateOrderStatus(id, status) {
  const rows = await getClient().query(
    "UPDATE orders SET status = $2, updated_at = now() WHERE id = $1::uuid RETURNING id, order_number, customer_id, customer, items, subtotal, payment_method, payment_status, status, created_at, updated_at",
    [id, status]
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}

async function deleteOrder(id) {
  const rows = await getClient().query(
    "DELETE FROM orders WHERE id = $1::uuid RETURNING order_number",
    [id]
  );
  return rows[0] || null;
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    orderCount: row.order_count === undefined ? undefined : Number(row.order_count)
  };
}

async function createCustomer(name, email, passwordHash, passwordSalt) {
  const rows = await getClient().query(
    "INSERT INTO customers (id, name, email, password_hash, password_salt) VALUES ($1::uuid, $2, $3, $4, $5) RETURNING id, name, email, created_at",
    [crypto.randomUUID(), name, email, passwordHash, passwordSalt]
  );
  return mapCustomer(rows[0]);
}

async function findCustomerByEmail(email) {
  const rows = await getClient().query(
    "SELECT id, name, email, password_hash, password_salt, created_at FROM customers WHERE email = $1",
    [email]
  );
  return rows[0] || null;
}

async function createCustomerSession(token, customerId, expiresAt) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const sql = getClient();
  await sql.transaction([
    sql.query("DELETE FROM customer_sessions WHERE expires_at < now()"),
    sql.query("INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES ($1, $2::uuid, $3)", [hash, customerId, expiresAt.toISOString()])
  ]);
}

async function readCustomerBySession(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const rows = await getClient().query(
    "SELECT c.id, c.name, c.email, c.created_at FROM customer_sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = $1 AND s.expires_at > now()",
    [hash]
  );
  return rows[0] ? mapCustomer(rows[0]) : null;
}

async function deleteCustomerSession(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await getClient().query("DELETE FROM customer_sessions WHERE token_hash = $1", [hash]);
}

async function readCustomerOrders(customerId) {
  const rows = await getClient().query(
    "SELECT id, order_number, customer_id, customer, items, subtotal, payment_method, payment_status, status, created_at, updated_at FROM orders WHERE customer_id = $1::uuid ORDER BY created_at DESC",
    [customerId]
  );
  return rows.map(mapOrder);
}

async function readCustomers() {
  const rows = await getClient().query(
    "SELECT c.id, c.name, c.email, c.created_at, COUNT(o.id) AS order_count FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 250"
  );
  return rows.map(mapCustomer);
}

async function deleteCustomer(id) {
  const rows = await getClient().query(
    "DELETE FROM customers WHERE id = $1::uuid RETURNING email",
    [id]
  );
  return rows[0] || null;
}

async function ping() {
  await getClient().query("SELECT 1");
}

module.exports = {
  initializeDatabase, readContent, writeContent, saveMedia, readMedia, pruneUnusedMedia,
  createSession, hasSession, deleteSession, createOrder, readOrders,
  updateOrderStatus, deleteOrder, createCustomer, findCustomerByEmail,
  createCustomerSession, readCustomerBySession, deleteCustomerSession,
  readCustomerOrders, readCustomers, deleteCustomer, ping
};
