# QUIET BATTLES™ — Technical Approach and Estimate

## How the brief shaped the demo

The updated overview establishes the path **QUIET BATTLES™ → The Archive → Series → Chapters → Chapter Chamber → Artifact → Acquisition**. The implementation uses an editorial story experience with a sample bag interaction rather than treating the homepage as a product grid.

The demo contains one featured Series, five complete sample Chapter stories, one linked sample hoodie, and a private content Studio. The client permits temporary imagery. The brand direction, copy, product specifications, and price remain assumptions pending approval.

## Architecture

```text
Vercel static site ──→ browser JavaScript ──→ Node.js JSON API ──→ Neon Postgres
          │                    │                    ↑
          │                    └── demo bag in localStorage
          └── images and fonts                       │
Studio editor ── protected API session ──────────────┘
Studio image upload ────────────────────────────────→ Neon media_assets
```

The public site is served from `public/`. `server.js` exposes the JSON API for local development; `api/index.js` exposes the same handler as a Vercel Function. `db.js` handles Neon queries and schema setup. `data/content.json` supplies seed content. The database tables and relationships are listed in [docs/database-schema.md](docs/database-schema.md).

## Why this stack

- **HTML, CSS, and browser JavaScript** keep a small assessment prototype fast to load and straightforward to explain.
- **Node.js** provides server-side content validation, image checks, and Studio authentication.
- **Neon Postgres** stores ordered Series, Chapters, products, uploaded demo images, and hashed Studio sessions. It provides durable data across local and hosted versions.
- **Vercel** serves the static site and runs the API function. The connected GitHub repository can deploy commits to the staging site.

The data model supports multiple Series, with Chapters belonging to a Series and products linked to a Chapter. Studio can add, edit, and remove these records. The public Archive and Series routes read all Series from the same content API. The initial database setup also migrates the previous single-Series demo content.

## Visitor experience

The homepage introduces the brand and points into The Archive. The Archive presents Series entries; Series 01 opens five Chapter Chambers. Each Chamber includes its own image, complete sample story, related artifact entry, and a link to the next Chapter. The artifact page shows front and back SVG illustrations, a sample INR price, size selection, product details, and an Add to Bag interaction. The bag is stored in the visitor's browser.

Chapters 02–05 currently link to the Series 01 sample hoodie to demonstrate the route. The product record belongs to Chapter 01; Studio can replace these relationships once the client supplies the real garment-to-story map.

## Content Studio

Studio uses an environment-held access key. Successful sign-in creates a random four-hour token; Neon stores only its SHA-256 hash. Protected requests require the token. Studio can manage homepage copy, multiple Series, Chapters and product details; PNG, JPEG, and WebP uploads are checked by file signature and limited to 2 MB. Saves validate slugs and cross-links and write the content in a database transaction.

This is suitable for an assessment demo. A production content team should use named staff accounts, role-based access, an audit log, and a dedicated media service instead of storing image bytes in Postgres.

## Performance, accessibility, and search

- Static CSS, JavaScript, SVG, and WebP assets are served directly by Vercel.
- Layouts have been checked at desktop and 390-pixel mobile widths. Buttons and links have visible keyboard focus, and reduced-motion preferences are respected.
- The homepage includes a page description, Open Graph text, a favicon, semantic headings, and descriptive image text.
- Pages currently use hash-based navigation. Production should adopt crawlable URLs, page-specific server metadata, a sitemap, optimized image variants, and analytics.
- Demo content endpoints are public by design. Admin updates require a Studio session; SQL values are parameterized.

## Local setup

See [README.md](README.md) for Node.js requirements and commands. Run `npm run db:init` after setting `DATABASE_URL` and `QB_ADMIN_KEY` in an ignored `.env.local` file. The migration is idempotent and seeds the database only when it has no site content.

## Asset and tool disclosure

The design uses five original editorial concept images generated with OpenAI image generation, supplementary Unsplash sample photography, and two locally authored SVG garment illustrations. Typography loads from Google Fonts. No website template, UI framework, CMS plugin, or paid UI plugin was used.

OpenAI Codex assisted with implementation, documentation, and code review. Playwright was used for browser checks and to capture the submission screenshots. These tools should be disclosed during the interview, and the developer should be ready to explain the code and trade-offs.

## Indicative production estimate

The overview now clarifies brand intent and the expected experience. A fixed production estimate still depends on final product count, story volume, approved media, checkout requirements, shipping and tax rules, and staff access needs.

| Scope | Estimated time after approval | Indicative fee |
| --- | --- | --- |
| Production editorial site and CMS: approved design, up to three Series, 15 Chapters, 10 products, media storage, staff roles, responsive QA, accessibility and SEO basics, deployment and handover | 6–8 weeks | ₹1,80,000–₹2,60,000 |
| Optional commerce completion: checkout, order records, stock hooks, shipping and tax rules, payment testing and launch QA | 2–4 additional weeks | ₹90,000–₹1,50,000 |
| Combined estimate | 8–12 weeks | ₹2,70,000–₹4,10,000 |

The estimate assumes the client supplies final brand copy, garment data, photography rights, size charts, legal policies, and payment and shipping accounts. It excludes hosting, database and media usage, payment-provider fees, content production, taxes, and ongoing maintenance. Convert this range to a fixed quote after requirements and acceptance criteria are agreed.

## Handover and maintenance

The site owner can update copy, Series, Chapters, products, and demo images in Studio. Source code is in GitHub, with Vercel deployments connected to the repository. Neon manages the content database. Before public commerce launch, rotate the Studio key, use individual staff accounts, move media to object storage, and integrate the selected payment and order services.
