# QUIET BATTLES™ — Assessment Submission

## Website

- **Website:** [Open the site](https://quiet-battles-demo.vercel.app)
- **Source:** [GitHub repository](https://github.com/anudeep2710/quiet-battles) — private; reviewers need repository access.
- **Walkthrough:** [Watch the short video](docs/walkthrough/quiet-battles-walkthrough.mp4) · [View current screenshots](docs/screenshots/README.md)

## What is included

- Responsive brand homepage and The Archive.
- Series 01 — THE GENTLE ARMOR™ with five story-led Chapter Chambers.
- Eight products connected to the stories, with category filters, sorting, size selection, front/back illustrations, and a bag.
- Customer sign-up, sign-in, sign-out, and private order history.
- Account-required checkout: bag → sign in or create an account → delivery details → order review → non-payable test QR → order confirmation.
- Neon-backed content Studio for homepage copy, Series, Chapters, products, images, customer records, and order status.
- Database schema, local setup instructions, architecture, technology stack, and screenshots in this repository.

## How to review

Start with the [README review guide](README.md) and [walkthrough video](docs/walkthrough/quiet-battles-walkthrough.mp4). The [technical approach](TECHNICAL_APPROACH.md) explains the architecture and production estimate. The [database schema](docs/database-schema.md), [readiness review](docs/READINESS_REVIEW.md), and [current screenshots](docs/screenshots/README.md) provide supporting details.

Studio is at /admin. On first use, the owner creates an account with an email, password, confirmation, and private Studio key. The key is configured as a server-only Vercel secret; the first account creation is available once and then the page switches to sign-in. Do not commit or publish the key. Share it privately with the intended reviewer if Studio access is part of the evaluation.

## Stack and tools

- Frontend: semantic HTML, CSS, and browser JavaScript.
- Backend: Node.js API, hosted as a Vercel Function.
- Database: Neon Postgres using @neondatabase/serverless.
- Hosting and source: Vercel and GitHub.
- Assets: five editorial concepts generated with OpenAI image generation, supplementary Unsplash photography, and original SVG garment illustrations.
- Fonts: Google Fonts.
- No site template, frontend framework, CMS plugin, or paid UI plugin was used. OpenAI Codex assisted with implementation and documentation. Playwright CLI captured screenshots; the Brag skill and Hyperframes composed the walkthrough, and FFmpeg finalized its poster and video.

## Data and payment boundaries

Product details, garment specifications, stories, and prices are illustrative and need brand approval. The QR is not payable. The checkout does not connect to UPI, a bank, or a payment provider; confirming the step records an order but does not verify payment or move money.

Customer account creation is required before placing an order. Do not use real customer details or reused passwords in this build. Email verification, password recovery, generic responses to account registration, effective rate limiting, privacy and retention controls, named staff accounts, stock, shipping, taxes, returns, transactional email, and live payment verification are not included. The site uses direct page paths, but route content is rendered in the browser; production SEO should add server-side or static rendering, route-specific social metadata, and a sitemap.

## Project estimate

The indicative timeline and fee for a production release are in [TECHNICAL_APPROACH.md](TECHNICAL_APPROACH.md). They depend on approved content, product data, media rights, shipping and tax rules, payment-provider requirements, and staff access needs.
