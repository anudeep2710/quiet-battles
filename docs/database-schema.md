# Neon Postgres content model

The setup script `scripts/init-db.js` creates the tables and migrates the earlier single-Series prototype. `db.js` contains the SQL and query code. The site stores structured copy as JSONB where it changes shape often; uploaded image bytes are stored only for this small demo.

| Table | Main fields | Purpose |
| --- | --- | --- |
| `site_settings` | `id`, `brand`, `hero`, `introduction`, `series`, `updated_at` | One row for global identity and homepage copy. The `series` JSONB field preserves a featured-Series copy for legacy migration compatibility. |
| `series` | `sort_order`, `slug`, `number`, `title`, `subtitle`, `description`, `image` | Ordered collection pages. `sort_order` is the primary key; `slug` is unique. |
| `chapters` | `sort_order`, `series_slug`, `number`, `slug`, `title`, `excerpt`, `image`, `product_slug`, `story` | Ordered Chapter Chambers. Chapter slugs are unique. `series_slug` groups each Chapter under a Series. |
| `products` | `sort_order`, `slug`, `name`, `category`, `description`, `price`, `image`, `secondary_image`, `sizes`, `details`, `chapter_slug` | Garment artifact details. Product slugs are unique; price is a nonnegative integer in INR. |
| `media_assets` | `id`, `mime_type`, `base64_data`, `created_at` | PNG, JPEG, and WebP demo uploads, capped at 2 MB each. |
| `admin_sessions` | `token_hash`, `expires_at` | Four-hour Studio sessions. The raw random token is never stored in the database. |
| `customers` | `id`, `name`, `email`, `password_hash`, `password_salt`, `created_at` | Demo customer accounts. Email is normalized and unique; passwords are derived with scrypt and never stored directly. |
| `customer_sessions` | `token_hash`, `customer_id`, `expires_at` | Seven-day customer sessions. The random browser token is stored only as a SHA-256 hash and sessions cascade when an account is removed. |
| `orders` | `id`, `order_number`, `customer_id`, `customer`, `items`, `subtotal`, `payment_method`, `payment_status`, `status`, timestamps | Demonstration checkout records, optional account link, delivery/item snapshots, and admin-managed fulfilment status. |

The application validates that Series and Chapter slugs are unique, each Chapter belongs to an existing Series, every Chapter points to an existing product, and each product points to an existing Chapter. These relationships are checked by the API when saving the full content document. The demo currently has one Series, five Chapters, and four sample products.

Checkout reprices every submitted item from the current product catalogue, validates its size, and stores an item snapshot rather than trusting browser prices. When a valid customer session is present, `orders.customer_id` links the record to that account; deleting the account sets the link to null and preserves the order snapshot. Order IDs are UUIDs and the public reference uses a date plus a random suffix. Studio can list orders, change their fulfilment status, remove demonstration records, list customers, and remove demo accounts. No actual payment credential or transaction is stored.

Studio writes content in a Postgres transaction. Media upload and retrieval use a UUID. A production system should move media to object storage, add explicit inventory and shipping models, and may model the content relationships with foreign keys and revision history.
