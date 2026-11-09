# Release readiness review

Reviewed 9 November 2026 for the QUIET BATTLES™ technical assessment.

## Decision

The storefront and source package are ready for a technical assessment review. The product story, catalogue, sample bag, account-required checkout gate, Neon-backed content reads, responsive layouts, screenshots, and walkthrough are available. The Studio is still at first access: its owner must complete the one-time setup before the admin dashboard can be demonstrated. This is not a live commerce release; the QR is non-payable and no real payment is processed.

## Release record

- Public source: [anudeep2710/quiet-battles](https://github.com/anudeep2710/quiet-battles)
- Vercel Production: [quiet-battles-demo.vercel.app](https://quiet-battles-demo.vercel.app)
- Vercel reports the Production alias is built from this repository's `main` branch; inspect the Vercel deployment record for the current SHA.
- `GET /api/health`: HTTP 200, `ok: true`, database reported as Neon Postgres.
- `GET /api/content`: HTTP 200 with one Series, five Chapters, and eight Products.
- `GET /api/admin/setup-status`: HTTP 200, `configured: false`. The owner account does not exist yet.
- The working tree is clean after publishing the reviewed release.

## Functional verification

| Area | Result |
| --- | --- |
| Public routes | Direct loads passed for the homepage, Archive, Series, all five Chapters, catalogue, all eight Products, sign-in, sign-up, account, checkout, and Studio. |
| Story navigation | Homepage → Archive → Series → Chapter → linked Product worked. A sample Back/Forward sequence also worked. |
| Account section links | `/account#account-orders` and `/account#account-discover` previously resolved as invalid pages. The route parser now preserves these in-page fragments; both URLs render the account sign-in screen when no account is signed in. Legacy `/#archive` still resolves to `/archive`. |
| Catalogue | All eight products displayed. Category filters, price sorting, rapid filter changes, and reset worked. Refresh resets filters to the full catalogue. |
| Product and bag | Adding without a size is rejected. Selecting a size adds the correct product; quantity, size, subtotal, and refresh persistence worked. Test items were removed after verification. |
| Checkout gate | In a fresh tab, the bag was preserved and checkout required sign-in or account creation. No customer details or order were submitted. |
| Responsive layout | At 320, 375, 390, and 768 px, 1024 × 768 tablet landscape, and 1440 × 900 desktop, the checked homepage, Archive, Series, Chapter, catalogue, product, authentication, checkout gate, and Studio first-access screens showed no horizontal overflow. At 320 px the menu and bag controls are at least 44 px high, and checkout actions fit the screen width. |
| Studio | The first-access form appears and includes owner email, password, confirmation, and Studio key. The separate sign-in form and server-side setup/login behavior pass the isolated auth check. A live owner account was not created and live content saves were not attempted. |

The previous homepage error was not reproduced during the repeated checks. The exact status and root cause of that earlier failure were not captured. Current health and content endpoints pass, but this does not prove the earlier incident can never recur.

## Automated checks

- `node --check public/app.js` — passed.
- `npm run test:unit` — 6 passed, 0 failed.
- `npm run test:admin-auth` — passed using mocked database methods; it covered first-run setup, concurrent setup, sign-in, protected access, versioned saves, and logout.
- `npm run test:smoke` was not run because it writes customer, order, image, and content records. No disposable Neon branch was confirmed for this release check.
- No live customer account, Studio owner, content save, or order was created.

## One action before demonstrating the admin dashboard

The owner should visit `/admin` and complete the one-time setup with an email, a unique password of at least 12 characters, confirmation, and the private Studio key configured on the server. An invalid empty setup request returned HTTP 400 (rather than the 503 used when the key is missing or too short); setup status remained false, so no owner was created. This creates the single owner account and signs that browser in. Enter the password and key yourself; do not place them in the public README, GitHub, screenshots, or video. After setup, the page offers the regular sign-in flow.

## Assessment scope and production gaps

Product copy, prices, sizes, and garment details are illustrative; stock is not tracked. The dummy QR cannot accept or verify payment. Order creation and Studio content writes were not tested against Neon in this review.

Before accepting real orders, add customer email verification and password recovery, move auth tokens to reviewed secure HttpOnly sessions with CSRF protections, define customer-data retention, add inventory reservation and shipping/tax rules, integrate and verify a real payment provider, and establish privacy, returns, and order-notification processes. The current Studio is a single-owner demo; production use needs named staff roles and audit history. Image uploads are stored in Neon for this small prototype and should move to managed object storage before scale.

See the [README](../README.md) for the user guide, local setup, stack, architecture diagram, screenshots, walkthrough, and estimate.
