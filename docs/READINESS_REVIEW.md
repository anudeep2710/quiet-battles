# Release readiness review

Reviewed 10 November 2026 for the QUIET BATTLES™ technical assessment.

## Decision

The website is ready for assessment review. The storefront, archive, product catalogue, customer account flow, account-required checkout, Neon-backed content, Studio owner account, product-activity graph, responsive layouts, screenshots, and walkthrough are available. The payment QR is non-payable; no real payment is processed.

The Studio product editor now requires complete product information before saving. The server independently validates the same requirements, and all content writes and image uploads require an authenticated Studio session.

## Release record

- Public source: [anudeep2710/quiet-battles](https://github.com/anudeep2710/quiet-battles)
- Vercel Production: [quiet-battles-demo.vercel.app](https://quiet-battles-demo.vercel.app)
- Production alias is connected to this repository's `main` branch.
- `GET /api/health`: HTTP 200; Neon Postgres is reachable.
- `GET /api/content`: HTTP 200 with one Series, five Chapters, and eight Products.
- `GET /api/admin/setup-status`: HTTP 200, `configured: true`; Studio owner setup is complete.
- Empty setup/login probes returned HTTP 400/401 respectively, confirming configuration while creating no account or session.
- No production content, customer, order, or image records were changed during this review.

## Functional verification

| Area | Result |
| --- | --- |
| Public routes | Direct loads passed for the homepage, Archive, Series, all five Chapters, catalogue, all eight Products, sign-in, sign-up, account, checkout, and Studio. |
| Story navigation | Homepage → Archive → Series → Chapter → linked Product worked. A sample Back/Forward sequence also worked. |
| Account section links | `/account#account-orders` and `/account#account-discover` remain on the account page. Legacy `/#archive` resolves to `/archive`. |
| Catalogue | All eight products displayed. Category filters, price sorting, rapid filter changes, and reset worked. |
| Product and bag | Adding without a size is rejected. Selecting a size adds the correct product; quantity, size, subtotal, and refresh persistence worked. Test items were removed after verification. |
| Checkout gate | In a fresh tab, the bag was preserved and checkout required sign-in or account creation. No customer details or order were submitted. |
| Responsive layout | At 320, 375, 390, and 768 px, 1024 × 768 tablet landscape, and 1440 × 900 desktop, the checked routes showed no horizontal overflow. At 320 px the menu and bag controls are at least 44 px high, and checkout actions fit the screen width. |
| Studio access | The live setup status is configured. The user-provided screenshot shows the signed-in product editor. Content edits and image uploads are protected by the admin-session guard. |
| Product validation | Required product fields are marked in Studio. An incomplete draft is stopped client-side and receives the same validation server-side; a new product cannot be published with a zero price, missing size, image, description, detail, or invalid chapter link. |
| Product activity | Studio shows a horizontal bar chart of units and order count per product in non-payable demo orders. Products with no recorded demo orders remain visible at zero, and archived products remain in the chart. Its protected API returns aggregates only and no customer data. A read-only query against Neon confirmed the stored product counts. |

The earlier homepage error did not recur during the previous route review. Its exact original status and root cause were not captured.

## Automated checks

- `node --check server.js`, `node --check public/app.js`, and `node --check scripts/admin-auth-test.js` — passed.
- `npm run test:unit` — 6 passed, 0 failed.
- `npm run test:admin-auth` — passed with mocked database methods. It covers owner setup, login, admin-only writes and analytics, product-activity aggregation, required product fields, versioned content saves, stale-write rejection, and logout.
- `npm run test:smoke` was not run because it writes customer, order, image, and content records. No disposable Neon branch was confirmed for this check.

## Assessment scope and production gaps

Product copy, prices, sizes, and garment details remain illustrative and require brand verification. Inventory is not tracked. The dummy QR cannot accept or verify payment. This is an assessment prototype, not a live commerce release.

Before accepting real orders, add customer email verification and password recovery, reviewed secure HttpOnly sessions with CSRF protections, data-retention rules, inventory reservation, shipping/tax rules, a verified payment provider, and privacy, returns, and order-notification processes. The current Studio is a single-owner demo; production use needs named staff roles and audit history. Image uploads are stored in Neon for this small prototype and should move to managed object storage before scale.

See the [README](../README.md) for the user guide, local setup, stack, architecture diagram, screenshots, walkthrough, and estimate.
