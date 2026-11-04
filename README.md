# QUIET BATTLES™ — Website Development Demo

A small, runnable prototype based on the assessment brief. It includes the public storefront, an editorial Archive and Series 01 with five chapter entries, a full first Chapter page, a sample product page, a demo cart, and a local content studio.

## Run it

Requires Node.js 24.15 or newer. This prototype uses Node’s built-in SQLite module; no package installation is needed.

    node server.js

Open http://127.0.0.1:4173.

Open Studio in the navigation or footer to edit the demo. The local demo key is quietbattles-demo. You can edit the homepage, series, chapter entries, and products; add or remove chapters and products; and upload PNG, JPG, or WebP images up to 5 MB.

## Architecture

- public/ contains the responsive browser experience and its styles.
- server.js is a dependency-free Node.js HTTP server with JSON API routes.
- data/content.json seeds the database on first run.
- data/quiet-battles.sqlite stores brand settings, chapters, and products in SQLite tables.
- Uploaded images are saved under public/uploads/.
- The demo cart is stored in the visitor’s browser with localStorage.

The studio signs in through a short-lived server session. Updates use a database transaction through protected local API routes. Image uploads are saved on the local disk. The sample cart does not connect to checkout, payment, inventory, or order management.

## Demo boundaries

This is a local assessment prototype, not a production commerce system. The default studio key is public in the demo and must be replaced with the QB_ADMIN_KEY environment variable before any private deployment. Sessions are held in memory, content is stored in a local JSON file, and uploads are stored on the local disk. A hosted project would need a persistent database and media store, a managed authentication provider, and a payment provider if checkout is added.

The visual direction, garment specification, price, stories, and images are demonstration content because the detailed brand requirements were not supplied. Editorial photographs load from Unsplash, typefaces load from Google Fonts, and the sample hoodie illustration is an original local SVG. No UI framework or paid plugin is used.

## Suggested next step for a full project

Confirm the missing brand requirements, approved copy and photography, product data, ecommerce/checkout scope, shipping and returns rules, and expected hosting/CMS ownership. Those decisions affect the final stack, estimate, and launch plan.
