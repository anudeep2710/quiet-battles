# QUIET BATTLES™ — Assessment Submission

**Assessment deadline:** 11 November 2026, 6:00 PM IST

## Working demonstration

https://quiet-battles-demo.vercel.app

The demo follows the brand path from the homepage to The Archive, a Series, a Chapter Chamber, its sample artifact, and the demo bag. It includes five complete sample stories, a responsive layout, and a Neon-backed Studio.

## Source code and local run instructions

- Private GitHub repository: https://github.com/anudeep2710/quiet-battles-demo
- A portable source ZIP is provided alongside this submission. The ZIP excludes local environment files and Studio credentials.
- Setup and run instructions: [README.md](README.md)

Reviewers will need access to the private repository or the source ZIP.

## Screenshots and demonstration evidence

The screenshot index is [docs/screenshots/README.md](docs/screenshots/README.md). It includes desktop and mobile views of the homepage and product, Archive, Series 01, Chapter Chambers, the demo bag, and Studio. The capture script can reproduce them with Playwright.

## Technologies

- Frontend: hand-written HTML, CSS, and browser JavaScript.
- Backend: Node.js API, run locally by `server.js` and deployed as a Vercel Function.
- Database: Neon Postgres through `@neondatabase/serverless`.
- Hosting and source: Vercel and GitHub.
- External services and assets: Unsplash sample photography, Google Fonts, two original images generated with OpenAI image generation, and original local SVG garment illustrations.

No site template, frontend framework, CMS plugin, or paid UI plugin was used. OpenAI Codex assisted with implementation and documentation; Playwright was used for browser checks and screenshot capture. These tools are disclosed for the technical evaluation.

## Database and Studio

The schema, fields, and relationships are documented in [docs/database-schema.md](docs/database-schema.md). Studio at `/#admin` can edit brand and homepage content; add, edit, and remove Series and Chapters; manage products; and upload images. Image uploads up to 2 MB are stored in Neon for this demo.

The Studio key is kept outside source control. Enter it privately during the review; do not include it in the submission.

## Architecture

Visitors load static files from Vercel. The browser requests published content from a Node API, which reads Neon. Studio edits use a protected API session and write content to Neon. The selected size and bag are stored in the visitor's browser.

## Demonstration boundaries

All stories, garment details, product price, and some photography are sample material. The product illustrations are original SVG concepts. Chapters 02–05 link to the sample Series 01 artifact to demonstrate the journey; only Chapter 01 owns that sample product record. The client can replace these links and content through Studio.

The bag does not create an order or process payment. Stock control, order management, shipping, returns, customer accounts, and payment integration are outside the prototype. The current inner pages use hash-based URLs, so production SEO requires crawlable routes and page-specific server metadata.

## Indicative full-project estimate

The updated overview clarifies the brand and demo scope. The production estimate in [TECHNICAL_APPROACH.md](TECHNICAL_APPROACH.md) remains provisional until the client supplies approved assets, final product and content volume, and commerce rules.
