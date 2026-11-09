# Product and submission readiness review

## Decision

The source is suitable to present as a working assessment prototype with clearly stated limits. It is not ready to process real customer orders or payments. The customer journey requires an account, but the QR is non-payable and no money moves.

The current production deployment includes the latest Studio access fix. After applying the additive schema migration to the connected Neon `main` branch on 9 November 2026, `GET /api/health` and `GET /api/content` returned 200; content contains one Series, five Chapters, and eight products. `GET /api/admin/setup-status` reports `configured: false`, so the one-time Studio owner account still needs to be created. Live customer signup, Studio saves, and order creation remain unverified.

## Current verification evidence

On 9 November 2026, Playwright captured the current local-source homepage, Archive, Series, Chapter, catalogue, product page, bag with one sample item, sign-in and sign-up forms, checkout account gate on desktop and mobile, and first-use Studio setup screen. The capture-only preview served `data/content.json`, blocked API routes that could modify a database, and returned the not-configured state for the Studio setup view. It did not connect to Neon, submit a customer account, create an order, create a Studio owner, or save content.

Earlier review recorded six passing unit tests, a passing mocked Studio-auth check, and successful JavaScript syntax checks. The latest admin-access toggle was checked in Chrome; `npm run test:admin-auth` passed. HyperFrames checked the walkthrough composition: zero errors in lint, runtime, layout, motion, and contrast, zero craft warnings, and five sampled frames. Six non-blocking structural lint warnings remain in the composition.

## Requirements check

| Requirement | Evidence | Status |
| --- | --- | --- |
| Premium homepage, brand introduction, and navigation | Current-source desktop/mobile screenshots and page captures | Covered |
| Archive, Series, and five Chapters | Current-source captures show Archive, Series 01, Chapter 01; content contains five Chapters | Covered |
| Product page and catalogue | Eight sample products, product details, size selection, catalogue filters and sorting | Covered in UI; sizes, price, stock, and product specifications are illustrative |
| Account-required purchase flow | Bag screenshot and checkout account gate; API validates customer session and recalculates catalog prices | UI observed; account creation, signed-in checkout, and order creation not run against Neon |
| Non-payable QR and order record | Source marks test orders `demo_recorded` / `not_payable`; tests cover order contract and recovery | Migration preserved three existing demo/test QR orders and marked them non-payable; no new order was created during verification |
| Backend and Neon database | Node API and schema cover content, products, media, customers, sessions, orders, idempotency, and rate limits | Live health and content reads passed after schema migration; customer/order writes remain unverified |
| Studio/CMS | First-use setup screen and code for homepage, Series, Chapter, product, image, customer, and order management | Live first-access form loads; owner account and content save not yet verified |
| Responsive experience | Current-source screenshots at 1440 px desktop and 390 px mobile | Two widths observed; tablet, broad device matrix, and formal accessibility audit remain unrun |
| SEO and performance | Semantic markup, metadata, static assets, focus styles, reduced motion support | Partial; no measured performance report, route-specific social metadata, sitemap, or server-rendered pages |
| Submission materials | README walkthrough, stack, architecture diagram, use guide, screenshots, and 21-second video | Present; screenshots/video are local captures and predate the latest admin-link styling and Neon migration |

## Main gaps before real commerce

- Create the one-time Studio owner account and verify a content save with sample copy. Do not use real customer information for assessment testing.
- If full signup and order-write tests are needed, run them against a disposable Neon branch and remove the test data afterward.
- Customer email verification and password recovery are missing. Customer and Studio tokens remain in browser `sessionStorage`; production should use reviewed secure, HttpOnly, SameSite cookies and CSRF protections.
- Define privacy notices, retention/anonymization rules, named Studio users, roles, recovery, and an audit log before storing real personal data.
- Inventory reservation, shipping and tax calculation, returns, order messaging, transactional email, and payment-provider verification are not implemented.
- Replace database-stored image bytes with managed object storage and optimized image sizes at production scale.
- Add crawlable, server-rendered or pre-rendered page content, route-specific social metadata, a sitemap, and measured performance monitoring.
- Brand copy, photography rights, garment specifications, size charts, prices, and availability need approval.

## Safe submission steps

1. Use the README reviewer guide and local screenshots/video to explain the current source. The hosted deployment and Neon content API are current and verified.
2. Create the one-time Studio owner only when ready to demonstrate the admin; use sample content and avoid real customer information.
3. Use a disposable Neon branch for full signup, order-write, and recovery tests; do not treat the dummy QR as payment.
4. Keep `.env.local`, `.studio-key`, Studio credentials, and Neon connection strings out of Git, the video, screenshots, and reviewer materials.
5. Remove synthetic accounts, images, orders, and uploaded content from the disposable branch after verification.

See [the README](../README.md) for use instructions, local setup, architecture, screenshots, video, and estimate.
