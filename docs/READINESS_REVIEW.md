# Product and submission readiness review

## Decision

The source is suitable to present as a working assessment prototype with clearly stated limits. It is not ready to process real customer orders or payments. The customer journey requires an account, but the QR is non-payable and no money moves.

The Vercel link is an earlier release. The current source, screenshots, and walkthrough have not been deployed together. The latest Neon schema migration has not been applied or verified against the connected branch, so current database-backed account, order, and Studio writes remain unverified.

## Current verification evidence

On 9 November 2026, Playwright captured the current local-source homepage, Archive, Series, Chapter, catalogue, product page, bag with one sample item, sign-in and sign-up forms, checkout account gate on desktop and mobile, and first-use Studio setup screen. The capture-only preview served `data/content.json`, blocked API routes that could modify a database, and returned the not-configured state for the Studio setup view. It did not connect to Neon, submit a customer account, create an order, create a Studio owner, or save content.

The previous application-code review recorded six passing unit tests, a passing mocked Studio-auth check, and successful JavaScript syntax checks. The latest screenshot and video work changed documentation and media, not application code. HyperFrames checked the walkthrough composition: zero errors in lint, runtime, layout, motion, and contrast, zero craft warnings, and five sampled frames. Six non-blocking structural lint warnings remain in the composition.

## Requirements check

| Requirement | Evidence | Status |
| --- | --- | --- |
| Premium homepage, brand introduction, and navigation | Current-source desktop/mobile screenshots and page captures | Covered |
| Archive, Series, and five Chapters | Current-source captures show Archive, Series 01, Chapter 01; content contains five Chapters | Covered |
| Product page and catalogue | Eight sample products, product details, size selection, catalogue filters and sorting | Covered in UI; sizes, price, stock, and product specifications are illustrative |
| Account-required purchase flow | Bag screenshot and checkout account gate; API validates customer session and recalculates catalog prices | UI observed; account creation, signed-in checkout, and order creation not run against Neon |
| Non-payable QR and order record | Source marks test orders `demo_recorded` / `not_payable`; tests cover order contract and recovery | Source/test evidence only; no Neon order created |
| Backend and Neon database | Node API and schema cover content, products, media, customers, sessions, orders, idempotency, and rate limits | Source reviewed; current schema migration and live writes unverified |
| Studio/CMS | First-use setup screen and code for homepage, Series, Chapter, product, image, customer, and order management | UI screenshot captured with mocked setup state; live owner setup/save not verified |
| Responsive experience | Current-source screenshots at 1440 px desktop and 390 px mobile | Two widths observed; tablet, broad device matrix, and formal accessibility audit remain unrun |
| SEO and performance | Semantic markup, metadata, static assets, focus styles, reduced motion support | Partial; no measured performance report, route-specific social metadata, sitemap, or server-rendered pages |
| Submission materials | README walkthrough, stack, architecture diagram, use guide, screenshots, and 21-second video | Present; assets are from local current source, while the deployed preview is older |

## Main gaps before real commerce

- Apply and verify the migration on a disposable Neon branch before connecting the updated API. Confirm customer auth, Studio setup/save, and test-order recovery there.
- Deploy the reviewed source and verify the deployment commit and environment before presenting the hosted experience as current.
- Customer email verification and password recovery are missing. Customer and Studio tokens remain in browser `sessionStorage`; production should use reviewed secure, HttpOnly, SameSite cookies and CSRF protections.
- Define privacy notices, retention/anonymization rules, named Studio users, roles, recovery, and an audit log before storing real personal data.
- Inventory reservation, shipping and tax calculation, returns, order messaging, transactional email, and payment-provider verification are not implemented.
- Replace database-stored image bytes with managed object storage and optimized image sizes at production scale.
- Add crawlable, server-rendered or pre-rendered page content, route-specific social metadata, a sitemap, and measured performance monitoring.
- Brand copy, photography rights, garment specifications, size charts, prices, and availability need approval.

## Safe submission steps

1. Use the README reviewer guide and local screenshots/video to explain the current source. Identify the hosted URL as the earlier release.
2. If a live database demonstration is needed, create or select a disposable Neon branch, back it up, apply the schema, then verify account setup, Studio saves, and test-order recovery with synthetic data.
3. Deploy the reviewed commit only after the database branch and environment are confirmed; then smoke-check the hosted pages and API.
4. Keep `.env.local`, `.studio-key`, Studio credentials, and Neon connection strings out of Git, the video, screenshots, and reviewer materials.
5. Remove synthetic accounts, images, orders, and uploaded content from the disposable branch after verification.

See [the README](../README.md) for use instructions, local setup, architecture, screenshots, video, and estimate.
