# QUIET BATTLES™ — Website Development Demo

A working assessment prototype for the QUIET BATTLES™ brief. It includes a cinematic homepage, responsive navigation, The Archive, Series 01 — THE GENTLE ARMOR™, five chapter entries, a complete Chapter 01 story, a sample product with two illustrated views, size selection, a browser bag, and a Neon-backed content Studio.

## Explore the demo

- Home: /
- Archive: /#archive
- Series 01: /#series
- Complete story: /#chapter/the-first-quiet
- Sample product: /#product/soft-armor-hoodie
- Content Studio: /#admin

The four later chapters are previews, as requested by the assignment. The bag supports adding an item in a selected size and changing its quantity. It does not create an order or take payment.

## Run locally

Requirements: Node.js 24.15 or newer, npm, and a Neon Postgres database.

1. Install packages with npm install.
2. Set DATABASE_URL and QB_ADMIN_KEY in an ignored .env.local file. QB_ADMIN_KEY must be at least 16 characters.
3. Initialize the database once with npm run db:init. This creates the tables and seeds the sample brand, five chapters, and product if the site is empty.
4. Start the site with npm run dev and open http://127.0.0.1:4173.

For the linked Vercel project, run npx vercel env pull .env.local after linking to download its development connection variables. The current Studio key is kept in the ignored .studio-key file in this workspace. Never commit either file.

Run npm run test:smoke while the local server is running on port 4174. The smoke check exercises public reads, Studio sign-in, chapter and product writes, image upload and retrieval, and sign-out. It restores the original content before exiting.

## Maintain the site

Open Studio, enter the Studio key, and choose Brand & home, Series & chapters, or Products. Edit text, image URLs, slugs, story paragraphs, price, sizes, details, and both product views. Use the image picker to upload PNG, JPEG, or WebP files up to 2 MB. Save changes to publish them. New chapters and products can be added from their respective tabs. Every chapter must refer to an existing product slug, and every product must refer to an existing chapter slug.

Content is saved in Neon Postgres. Uploaded images and four-hour Studio sessions also persist in Neon. The image route serves an uploaded image from the database by its ID. For a larger production site, move media to object storage and add role-based access, image optimization, and an audit log.

## Architecture

    Visitor browser → static HTML/CSS/JavaScript → JSON API → Neon Postgres
    Studio editor ───────────────────────────────→ protected JSON API
    Studio image picker → upload API → Neon media_assets table
    Visitor bag → browser localStorage

The Vercel deployment serves the public folder as static assets and runs the API from api/index.js. The same server.js handles requests when running locally. The database schema is created by scripts/init-db.js. The seed content is in data/content.json.

Database tables:

| Table | Data |
| --- | --- |
| site_settings | Brand, hero, introduction, Series 01 metadata |
| chapters | Chapter order, slug, story, image, linked product |
| products | Product details, price in INR, sizes, linked chapter |
| media_assets | Uploaded image type and bytes |
| admin_sessions | Hashed Studio token and expiration |

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

## Stack and third-party disclosure

- Frontend: hand-written semantic HTML, responsive CSS, and browser JavaScript. No template, UI framework, or CMS plugin.
- Backend: Node.js HTTP API, deployed as a Vercel Node Function.
- Database: Neon Postgres, accessed with @neondatabase/serverless.
- Hosting: Vercel. The connected GitHub repository deploys new pushes.
- External media: sample editorial photography from Unsplash. The garment graphic is a local SVG made for this demo.
- Fonts: Barlow Condensed, DM Sans, and IBM Plex Mono loaded from Google Fonts.
- Development assistance: OpenAI Codex helped implement, document, and review this prototype. Playwright CLI was used for browser checks. GitHub hosts the source.

The detailed brand document, licensed final imagery, garment specifications, approved copy, inventory, and commerce policies were not provided. The visual direction, stories, price, and product copy are clearly sample material.

## Demo boundaries

This is an assessment prototype, not a live store. Checkout, payment, stock control, order management, shipping, returns, and production user accounts are outside this demo. The current hash-based pages have descriptive titles and metadata but are not independently crawlable routes; a production version should use server-rendered or statically generated URLs for each series, chapter, and product. Keeping small demo uploads in Postgres is practical at this scale; production media should use object storage and optimized derivatives.

See TECHNICAL_APPROACH.md for the implementation rationale, seven-day plan, production roadmap, and indicative full-project quotation.
