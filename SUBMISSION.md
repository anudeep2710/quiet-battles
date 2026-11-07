# QUIET BATTLES™ — Assessment Submission

## Website

- **Website:** [Open the site](https://quiet-battles-demo.vercel.app)
- **Source:** [GitHub repository](https://github.com/anudeep2710/quiet-battles-demo) — private; reviewers need repository access.

## What is included

- Responsive brand homepage and The Archive.
- Series 01 — THE GENTLE ARMOR™ with five story-led Chapter Chambers.
- Eight products connected to the stories, with category filters, sorting, size selection, front/back illustrations, and a bag.
- Customer sign-up, sign-in, sign-out, and private order history.
- Account-required checkout: bag → sign in or create an account → delivery details → order review → non-payable test QR → order confirmation.
- Neon-backed content Studio for homepage copy, Series, Chapters, products, images, customer records, and order status.
- Database schema, local setup instructions, architecture, technology stack, and screenshots in this repository.

## How to review

Start with [README.md](README.md) for local setup and site routes. The [technical approach](TECHNICAL_APPROACH.md) explains the architecture and production estimate. The [database schema](docs/database-schema.md), [readiness review](docs/READINESS_REVIEW.md), and [screenshots](docs/screenshots/README.md) provide supporting details.

Studio is at /#admin and requires the private Studio key. The key is not included in source control or this document. Contact the developer separately to arrange access.

## Stack and tools

- Frontend: semantic HTML, CSS, and browser JavaScript.
- Backend: Node.js API, hosted as a Vercel Function.
- Database: Neon Postgres using @neondatabase/serverless.
- Hosting and source: Vercel and GitHub.
- Assets: five editorial concepts generated with OpenAI image generation, supplementary Unsplash photography, and original SVG garment illustrations.
- Fonts: Google Fonts.
- No site template, frontend framework, CMS plugin, or paid UI plugin was used. OpenAI Codex assisted with implementation and documentation; Playwright was used for browser review and screenshots.

## Data and payment boundaries

Product details, garment specifications, stories, and prices are illustrative and need brand approval. The QR is not payable. The checkout does not connect to UPI, a bank, or a payment provider; confirming the step records an order but does not verify payment or move money.

Customer account creation is required before placing an order. Do not use real customer details or reused passwords in this build. Email verification, password recovery, generic responses to account registration, effective rate limiting, privacy and retention controls, named staff accounts, stock, shipping, taxes, returns, transactional email, and live payment verification are not included. The hash-based inner-page URLs also need a crawlable route structure for production SEO.

## Project estimate

The indicative timeline and fee for a production release are in [TECHNICAL_APPROACH.md](TECHNICAL_APPROACH.md). They depend on approved content, product data, media rights, shipping and tax rules, payment-provider requirements, and staff access needs.
