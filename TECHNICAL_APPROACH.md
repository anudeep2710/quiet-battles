# QUIET BATTLES™ — Technical Approach

## Day 1 proposal

The supplied assessment asks for a branded storefront and a small content-management demonstration. The detailed brand requirements referenced by the assignment were not attached, so this prototype uses the tagline, series name, and scope from the assessment. Its visual direction and all product and story copy are samples that should be replaced with approved brand material.

## Demo architecture

    Visitor browser → Responsive storefront → Node.js HTTP API → SQLite database
    Studio editor ────────────────────────→ Node.js HTTP API
    Studio editor → Image upload route → Local uploads folder
    Visitor browser → Demo bag → Browser localStorage

### Technology choices

- **Frontend:** semantic HTML, responsive CSS, and browser JavaScript. No UI framework or paid plugin is used.
- **Backend:** Node.js built-in HTTP server and JSON API routes.
- **Database:** file-backed SQLite, with separate tables for brand/series settings, chapters, and products. Admin saves run in a transaction. The initial records come from data/content.json.
- **Media:** local PNG, JPG, and WebP uploads under public/uploads/; the editorial sample photographs load from Unsplash.
- **Cart:** browser localStorage for a persistent demo bag. There is no checkout, payment, inventory, or order service.
- **Fonts:** Barlow Condensed, DM Sans, and IBM Plex Mono from Google Fonts.
- **Hosting:** local preview only. The database and uploaded files are on disk, so the current build needs a persistent host and storage before it can become a shared staging site.

The built-in node:sqlite module is used to keep the demo dependency-free. It is documented as a release candidate in Node.js 24.15 ([Node.js SQLite documentation](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html)), so a production project should select a stable database driver and managed database as part of the approved architecture.

## Content model

| Table | Purpose |
| --- | --- |
| site_settings | Brand name and tagline, homepage hero, introduction, and Series 01 metadata |
| chapters | Chapter number, URL slug, title, summary, image, linked product, and story paragraphs |
| products | Product name, URL slug, description, integer price in INR, image, size options, details, and linked chapter |

The studio can update content, add or remove chapters and products, and upload images. The public site reads the same content through the API.

## API routes

| Method and route | Purpose |
| --- | --- |
| GET /api/content | Return public brand, series, chapter, and product content |
| POST /api/admin/login | Create a four-hour local studio session |
| POST /api/admin/logout | End the current studio session |
| PUT /api/admin/content | Validate and transactionally save the content model |
| POST /api/admin/upload | Save an image after checking its type and 5 MB size limit |
| GET /api/health | Local server status |

## Current scope and limits

- All five Series 01 chapters are listed. Chapter 01 has the complete sample story; Chapters 02–05 are short previews.
- The sample product is priced in INR and supports size selection and add/remove quantity in the bag.
- The studio key is displayed on the local demo sign-in screen. Replace it with QB_ADMIN_KEY before any private deployment. Sessions are stored in memory and expire when the server restarts.
- The site uses hash-based client-side navigation. It is appropriate for a self-contained demo; production SEO should use crawlable page routes and page-specific metadata.
- Product details, imagery, price, and copy are placeholders pending the detailed requirements and approved brand assets.

## Seven-day assessment plan

| Day | Work |
| --- | --- |
| 1 | Confirm the full brand requirements, scope boundaries, content, and technical approach |
| 2 | Lock page structure, design direction, and content model |
| 3 | Build responsive homepage, navigation, and reusable visual elements |
| 4 | Build Archive, Series 01, chapter index, and Chapter 01 story page |
| 5 | Build the sample product page, size selection, and demo cart |
| 6 | Add the content studio, SQLite persistence, image management, and responsive polish |
| 7 | Review the demo, prepare source handoff, explain the architecture, and submit a scoped estimate |

## Full-project estimate

The assignment does not include the detailed requirements document, approved assets, product count, payment/shipping requirements, or hosting expectations. A fixed project price would be guesswork at this stage. A responsible quote needs those inputs plus the developer’s rate. Checkout, order management, shipping/tax rules, and production authentication should be estimated separately from this demo.
