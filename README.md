# QUIET BATTLES™ — Website Development Demo

A working assessment prototype for the QUIET BATTLES™ brief. It includes a cinematic homepage, responsive navigation, a multi-series Archive, Series 01 — THE GENTLE ARMOR™, five complete Chapter Chambers, one sample garment with two illustrated views, size selection, an end-to-end demo acquisition, and a Neon-backed Studio for managing Series, Chapters, products, images, and orders.

**Assessment deadline:** 11 November 2026, 6:00 PM IST.

## Explore the demo

- Home: /
- Archive: /#archive
- Series 01: /#series
- Complete story: /#chapter/the-first-quiet
- Sample product: /#product/soft-armor-hoodie
- Content Studio: /#admin

The five chapters have complete sample stories. The bag supports size selection and quantity changes. Checkout collects sample delivery details, presents a clearly labelled non-payable QR, and creates a demonstration order in Neon. It never connects to a bank, UPI account, or payment provider and never transfers money.

Screenshots of the homepage, Archive, Series, Chapters, product, mobile layout, demo bag, and Studio are in [docs/screenshots](docs/screenshots/README.md).

## Run locally

Requirements: Node.js 24.15 or newer, npm, and a Neon Postgres database.

1. Install packages with npm install.
2. Set DATABASE_URL and QB_ADMIN_KEY in an ignored .env.local file. QB_ADMIN_KEY must be at least 16 characters.
3. Run npm run db:init. It creates or migrates the tables and seeds the sample brand, one Series, five Chapters, and one product if the site is empty.
4. Start the site with npm run dev and open http://127.0.0.1:4173.

For the linked Vercel project, run npx vercel env pull .env.local after linking to download its development connection variables. The current Studio key is kept in the ignored .studio-key file in this workspace. Never commit either file.

Run npm run test:smoke while the local server is running on port 4174. The smoke check exercises public reads, checkout order creation, Studio order listing and status updates, chapter and product writes, image upload and retrieval, sign-out, and cleanup. It restores the original content and deletes its temporary order before exiting.

## Maintain the site

Open Studio, enter the Studio key, and choose Brand & home, Series & chapters, Products, or Orders. Edit text, image URLs, slugs, story paragraphs, price, sizes, details, and both product views. Add and remove Series, Chapters, and products. Use the image picker to upload PNG, JPEG, or WebP files up to 2 MB. The Orders tab shows customer details and item snapshots, updates fulfilment status, refreshes the ledger, and removes demonstration orders. Chapters and products must point to existing linked items.

Content is saved in Neon Postgres. Uploaded images and four-hour Studio sessions also persist in Neon. The image route serves an uploaded image from the database by its ID. For a larger production site, move media to object storage and add named staff accounts, role-based access, image optimization, and an audit log.

## Architecture

    Visitor browser → static HTML/CSS/JavaScript → JSON API → Neon Postgres
    Studio editor ───────────────────────────────→ protected JSON API
    Studio image picker → upload API → Neon media_assets table
    Visitor bag → browser localStorage → dummy-QR checkout → Neon orders

The Vercel deployment serves the public folder as static assets and runs the API from api/index.js. The same server.js handles requests when running locally. The database schema is created and migrated by scripts/init-db.js. The seed content is in data/content.json.

Database tables:

| Table | Data |
| --- | --- |
| site_settings | Brand, hero, introduction, and featured Series compatibility data |
| series | Ordered Series metadata and image |
| chapters | Series link, chapter order, slug, story, image, linked product |
| products | Product details, price in INR, sizes, linked chapter |
| media_assets | Uploaded image type and bytes |
| admin_sessions | Hashed Studio token and expiration |
| orders | Demo customer, item snapshots, subtotal, payment label, fulfilment status and timestamps |

See [docs/database-schema.md](docs/database-schema.md) for fields, constraints, and content relationships.

Studio saves use one Neon transaction. SQL parameters are bound by the Neon serverless driver. The Studio key is held in the deployment environment; it is never sent to visitors except when they enter it to sign in. Session tokens are random, stored as hashes, and revoked on sign-out.

## API

| Method and route | Purpose |
| --- | --- |
| GET /api/health | Confirm the API can query Neon |
| GET /api/content | Read public site content |
| GET /api/media/:id | Read an uploaded image |
| POST /api/admin/login | Sign in with the Studio key |
| POST /api/admin/logout | Revoke a Studio session |
| PUT /api/admin/content | Validate and save content |
| POST /api/admin/upload | Validate and store an image |
| POST /api/orders | Reprice the bag and create a demonstration order |
| GET /api/admin/orders | List orders in Studio |
| PATCH /api/admin/orders/:id | Update an order status |
| DELETE /api/admin/orders/:id | Remove a demonstration order |

## Stack and third-party disclosure

- Frontend: hand-written semantic HTML, responsive CSS, and browser JavaScript. No template, UI framework, or CMS plugin.
- Backend: Node.js HTTP API, deployed as a Vercel Node Function.
- Database: Neon Postgres, accessed with @neondatabase/serverless.
- Hosting: Vercel. The connected GitHub repository deploys new pushes.
- Images: five original editorial concepts generated with OpenAI image generation, supplementary sample photography from Unsplash, and original local SVG garment illustrations.
- Fonts: Barlow Condensed, DM Sans, and IBM Plex Mono loaded from Google Fonts.
- Development assistance: OpenAI Codex helped implement, document, and review this prototype. Playwright was used to check the browser experience and capture screenshots. GitHub hosts the source.

The updated overview clarifies the brand philosophy, architecture, and assessment scope. Approved brand assets, final copy, garment specifications, stock, payment, shipping, returns, and commerce policies are still needed for a production launch. The visual direction, stories, price, and product copy are clearly sample material.

## Demo boundaries

This is an assessment prototype, not a live payment system. Its complete demonstration flow records an order, but the QR is deliberately non-payable and no payment is verified or transferred. Shipping rates, taxes, stock reservations, returns, transactional email, customer accounts, abuse prevention, and production staff roles remain outside the demo. Use sample customer details only. The current hash-based pages are not independently crawlable routes; production should use server-rendered or statically generated URLs. Production media should also move to object storage with optimized derivatives.

See TECHNICAL_APPROACH.md for the implementation rationale, seven-day plan, production roadmap, and indicative full-project quotation.
