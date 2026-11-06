# QUIET BATTLES™ — Assessment Submission

**Assessment deadline:** 11 November 2026, 6:00 PM IST

## Working demonstration

https://quiet-battles-demo.vercel.app

The demo follows the brand path from the homepage to The Archive, a Series, a Chapter Chamber, its artifact, and Acquisition. It includes five complete sample stories, eight products with original front/back artwork, category filters, sorting, quick add, customer sign-up/sign-in, a private order archive, a responsive dummy-QR checkout that records demonstration orders, and a Neon-backed Studio.

## Source code and local run instructions

- Private GitHub repository: https://github.com/anudeep2710/quiet-battles-demo
- A portable source ZIP is provided alongside this submission. The ZIP excludes local environment files and Studio credentials.
- Setup and run instructions: [README.md](README.md)

Reviewers will need access to the private repository or the source ZIP.

## Screenshots and demonstration evidence

The screenshot index is [docs/screenshots/README.md](docs/screenshots/README.md). It includes desktop and mobile views of the homepage and product, Archive, artifact catalogue, Series 01, Chapter Chambers, sign-in/sign-up, customer order archive, bag, delivery form, dummy QR, order confirmation, and Studio order/customer ledgers. The capture script can reproduce them with Playwright.

## Technologies

- Frontend: hand-written HTML, CSS, and browser JavaScript.
- Backend: Node.js API, run locally by `server.js` and deployed as a Vercel Function.
- Database: Neon Postgres through `@neondatabase/serverless`.
- Hosting and source: Vercel and GitHub.
- External services and assets: Unsplash sample photography, Google Fonts, five original images generated with OpenAI image generation, and sixteen original local SVG garment views.

No site template, frontend framework, CMS plugin, or paid UI plugin was used. OpenAI Codex assisted with implementation and documentation; Playwright was used for browser checks and screenshot capture. These tools are disclosed for the technical evaluation.

## Database and Studio

The schema, fields, and relationships are documented in [docs/database-schema.md](docs/database-schema.md). Studio at `/#admin` can edit brand and homepage content; add, edit, and remove Series and Chapters; manage products; and upload images. Image uploads up to 2 MB are stored in Neon for this demo.

The Studio key is kept outside source control. Enter it privately during the review; do not include it in the submission. Studio also includes an Orders ledger for reviewing delivery details and item snapshots, updating fulfilment status, refreshing records, and deleting demonstration orders. Its Customers tab lists customer accounts, linked-order counts, and demo-account deletion controls.

## Architecture

Visitors load static files from Vercel. The browser requests published content from a Node API, which reads Neon. The selected size and bag are stored in the visitor's browser. Customer passwords are salted and hashed server-side; only hashed session tokens are stored in Neon. Checkout submits delivery and bag data to the API; the server validates current products and prices before writing the demonstration order, linked to the signed-in customer when present. Studio edits and order/customer operations use a separate protected API session.

## Demonstration boundaries

All stories, garment details, product prices, and some photography are sample material. The product illustrations are original SVG concepts. Chapters 01–04 each link to a distinct artifact; Chapter 05 returns to the Soft Armor Hoodie. The client can replace these relationships and content through Studio.

The acquisition flow creates a demonstration order and exposes it in Studio. The displayed QR is deliberately non-payable: it does not connect to UPI, a bank, or a payment gateway, and confirming it does not prove payment. Customer accounts and private order history work in the prototype. Email verification, password recovery, login throttling, stock reservation, shipping calculation, tax, returns, transactional messages, and live payment verification remain outside it. The current inner pages use hash-based URLs, so production SEO requires crawlable routes and page-specific server metadata.

## Indicative full-project estimate

The updated overview clarifies the brand and demo scope. The production estimate in [TECHNICAL_APPROACH.md](TECHNICAL_APPROACH.md) remains provisional until the client supplies approved assets, final product and content volume, and commerce rules.
