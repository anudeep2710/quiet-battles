# QUIET BATTLES™ — Assessment Submission

## 1. Working demonstration and staging link

https://quiet-battles-demo.vercel.app

Pages to review: home, The Archive, Series 01 — THE GENTLE ARMOR™, Chapter 01 — The First Quiet, and The Soft Armor Hoodie. The product page shows front and back illustrations, supports choosing a size, and adds the piece to a demo bag.

## 2. Source code

https://github.com/anudeep2710/quiet-battles-demo

The repository is private. Invite the assessment reviewers to the repository or provide a source archive when submitting it.

## 3. Technology stack

Hand-written HTML, CSS, and JavaScript; Node.js API; Neon Postgres with @neondatabase/serverless; Vercel hosting. Sample editorial photography is from Unsplash, fonts are served by Google Fonts, and the sample garment graphic is a local SVG. No site template, UI framework, or paid plugin was used.

OpenAI Codex assisted with implementation, documentation, and review. Playwright CLI was used for browser checks. This assistance should be disclosed during the technical evaluation, and the candidate should be ready to explain the code and decisions.

## 4. Backend, database, and admin demonstration

Use the Studio link in the site navigation. The Studio key is kept outside source control and should be entered privately during the evaluation. The Studio can edit brand and homepage copy, Series 01 metadata, chapter stories and images, product details and price, and can add or remove chapters and products. PNG/JPEG/WebP uploads up to 2 MB persist in Neon. Public pages read the edited data through the API.

The Neon schema has tables for site settings, chapters, products, media assets, and hashed Studio sessions. See README.md and TECHNICAL_APPROACH.md for the content model and API details.

## 5. Architecture

Vercel serves static files from public/ and sends API requests to a Node Function. The function reads and writes Neon Postgres. The visitor bag is stored in that visitor's browser. Database initialization and sample content are provided by scripts/init-db.js and data/content.json.

## 6. Verification

The local smoke check passed for public content, login, chapter and product edits, image upload, and sign-out. The hosted health and content APIs returned the expected Neon data. The homepage was checked in a real browser at desktop and 390-pixel mobile widths; the product bag flow was exercised on mobile.

## 7. Indicative completion timeline and quotation

Production editorial storefront and CMS: 6–8 weeks, ₹1,80,000–₹2,60,000. Optional checkout, orders, shipping and tax integration: another 2–4 weeks, ₹90,000–₹1,50,000. Combined estimate: 8–12 weeks, ₹2,70,000–₹4,10,000, excluding third-party charges and tax. The scope assumptions and exclusions are in TECHNICAL_APPROACH.md; a fixed quote requires the detailed brand requirements.

## 8. Demo limitations

Only Chapter 01 is a complete story; Chapters 02–05 are previews. Garment specification, price, copy, and editorial photographs are samples because the detailed requirements and approved assets were not provided. The bag does not process a payment or order. Hash-based inner pages need crawlable URLs before a production SEO launch.
