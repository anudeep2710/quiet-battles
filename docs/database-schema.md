# Neon Postgres content model

The setup script scripts/init-db.js creates or migrates the tables. db.js contains database queries and schema setup. Flexible copy is stored as JSONB; uploaded images are stored as base64 data for this small assessment build.

| Table | Main fields | Purpose |
| --- | --- | --- |
| site_settings | id, brand, hero, introduction, series, updated_at | Brand and homepage content. The series JSONB field preserves compatibility with the initial single-Series record. |
| series | sort_order, slug, number, title, subtitle, description, image | Ordered Series metadata. Slugs are unique. |
| chapters | sort_order, series_slug, number, slug, title, excerpt, image, product_slug, story | Ordered Chapter story and links to its Series and product. Chapter slugs are unique. |
| products | sort_order, slug, name, kind, category, description, price, image, secondary_image, sizes, details, chapter_slug | Product content and its link to a Chapter. Price is a nonnegative integer in INR. |
| media_assets | id, mime_type, base64_data, created_at | PNG, JPEG, and WebP image uploads, limited to 2 MB each. |
| admin_accounts | id, email, password_hash, password_salt, created_at | Singleton owner account for Studio. The primary-key check fixes the row to id 1; email is unique and the password uses scrypt with a random salt. |
| admin_sessions | token_hash, expires_at | Four-hour Studio sessions. Only the hash of the random token is stored. |
| customers | id, name, email, password_hash, password_salt, created_at | Customer account. Email is normalized and unique; passwords are derived with scrypt. |
| customer_sessions | token_hash, customer_id, expires_at | Seven-day customer session. The token is stored only as a SHA-256 hash; sessions cascade when an account is deleted. |
| orders | id, order_number, customer_id, customer, items, subtotal, payment_method, payment_status, status, timestamps | Customer-linked delivery and item snapshots, test-payment label, and Studio-managed fulfilment status. The nullable account link supports older records. |

Before saving content, the API checks that Series and Chapter slugs are unique, every Chapter belongs to a Series and has an existing product, and every product points to a Chapter. The current seed has one Series, five Chapters, and eight illustrative products.

Order requests require an authenticated customer session. The server rechecks each product, size, quantity, and price against the current catalogue, then saves an order snapshot. Deleting a customer account removes its sessions and sets the order's customer link to null while retaining the order record. Order IDs are UUIDs; the order reference includes a date and random suffix.

Studio can list orders, update fulfilment status, remove orders, list customers, and remove customer accounts. No payment credentials or payment transactions are stored. Content updates run in a Postgres transaction. A production release should use object storage for images and add explicit inventory, shipping, and content-revision models.
