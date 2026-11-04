# QUIET BATTLES™ — Technical Approach and Full-Project Estimate

## Brief and assumptions

The assignment names the brand, tagline, pages, example series, five chapters, sample product, and an editable backend. The referenced detailed brand requirements document was not supplied. The prototype therefore uses sample copy, sample pricing, sample editorial photographs, and a proposed visual direction. These need brand approval before a public launch.

## Why this stack

The demo uses native HTML, CSS, and JavaScript for a small, fast interface with little framework overhead. The Node.js API keeps content editing, login, validation, and image handling on the server. Neon Postgres provides a durable database shared by the local preview and Vercel deployment. The Neon serverless driver uses parameterized SQL over HTTPS, which suits short-lived Vercel Functions. Vercel serves static assets and runs the API; its Git connection supports preview and production deployments.

This choice keeps the assessment easy to explain while showing frontend, backend, database, API, and deployment work. A larger production catalogue may warrant a framework with server rendering and a specialist commerce platform. The full-project discovery phase should decide that with the actual requirements document in hand.

## Architecture and content flow

    Public page → /api/content → site_settings + chapters + products in Neon
    Studio → key login → hashed session in Neon → protected API
    Studio save → content validation → one Postgres transaction
    Studio upload → file signature check → media_assets in Neon → /api/media/:id
    Product page → selected size → localStorage demo bag

The seed file creates Series 01, five chapters, and the sample hoodie. Only Chapter 01 contains a full sample story; Chapters 02–05 remain previews. A new chapter or product can be added in Studio without editing source code.

## Security, reliability, performance, and SEO

- The Studio key is an environment secret of at least 16 characters. Login comparison uses a timing-safe check.
- Sessions expire after four hours; only token hashes are stored, and sign-out deletes the session.
- Admin writes require a valid session. Incoming content is bounded and validated, including linked slugs, image URLs, story lengths, and nonnegative integer prices.
- Uploaded PNG/JPEG/WebP files are capped at 2 MB and checked against their file signatures. Public images have immutable cache headers.
- Static CSS and JavaScript are served directly by Vercel; responsive layouts were checked at desktop and 390-pixel mobile widths.
- The homepage has a description, Open Graph text, a favicon, semantic headings, descriptive image text, and route-specific browser titles. Hash routing limits search indexing of inner pages. Production should use crawlable URLs, page-specific server metadata, a sitemap, image optimization, and analytics.
- This demo has no checkout or order service. A production launch needs managed commerce flows, legal policies, and a more complete admin permission model.

## Seven-day assessment plan

| Day | Deliverable |
| --- | --- |
| 1 | Read the available brief; document assumptions and choose the stack |
| 2 | Define page map, content model, editorial design direction, and interaction plan |
| 3 | Build responsive homepage, navigation, and shared visual system |
| 4 | Build Archive, Series 01, five chapter entries, and the complete Chapter 01 |
| 5 | Build the product page, size selection, and demo bag |
| 6 | Add the Neon-backed Studio, uploads, validation, and responsive verification |
| 7 | Verify the deployment and API, document architecture, and prepare submission |

## Production roadmap and indicative quotation

This is a provisional quotation because the full requirements document, approved assets, product count, checkout rules, shipping/tax rules, and support terms are missing.

| Scope | Time after approval | Indicative fee |
| --- | --- | --- |
| Production editorial storefront and CMS: approved design, up to three series, 15 chapters, 10 products, media storage, admin roles, responsive QA, accessibility and SEO basics, deployment and handover | 6–8 weeks | ₹1,80,000–₹2,60,000 |
| Optional commerce completion: secure checkout integration, order records, stock hooks, shipping and tax rules, payment testing and launch QA | 2–4 additional weeks | ₹90,000–₹1,50,000 |
| Combined estimated project | 8–12 weeks | ₹2,70,000–₹4,10,000 |

The estimate assumes brand copy, garment details, photography rights, size charts, legal policies, and payment/shipping accounts are supplied by the client. It excludes hosting, database and media usage, payment-provider fees, content production, tax, and ongoing maintenance. After the detailed requirements are reviewed, convert the chosen scope into a fixed deliverable list, acceptance criteria, milestones, and a final quote.

## Maintenance handover

The owner can edit existing text and images or add new chapters and products through Studio. A technical maintainer can change the layout or API in the GitHub repository, which is linked to Vercel. The database can be managed through Neon’s console and backed up using its managed features. Rotate the Studio key through Vercel environment settings and redeploy. Before public launch, replace the demo key flow with managed staff accounts and move uploaded media out of Postgres.
