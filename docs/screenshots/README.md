# Assessment screenshots

These screenshots show the demonstration's main paths on desktop and mobile. `scripts/capture-screenshots.py` reproduces them with Playwright. The Studio key is never part of an image. Mutating-mode screenshots can include the generated synthetic visitor details, so use a disposable demo database and never enter real customer details.

| File | View |
| --- | --- |
| `01-home-desktop.jpg` | Homepage and featured Series |
| `02-archive-desktop.jpg` | The Archive |
| `15-artifacts-desktop.jpg` | Eight-product Artifact catalogue with filters and sorting |
| `03-series-desktop.jpg` | Series 01 and its five Chapters |
| `04-chamber-the-first-quiet.jpg` | Chapter 01 Chamber and linked Artifact |
| `04-chamber-the-weight-you-carry.jpg` | Chapter 02 Chamber |
| `04-chamber-letting-someone-in.jpg` | Chapter 03 Chamber |
| `04-chamber-staying-tender.jpg` | Chapter 04 Chamber |
| `04-chamber-after-the-noise.jpg` | Chapter 05 Chamber |
| `05-artifact-desktop.jpg` | Product details, two views, size selection |
| `06-home-mobile.jpg` | Mobile homepage |
| `22-artifacts-mobile.jpg` | Mobile two-column Artifact catalogue |
| `07-artifact-mobile.jpg` | Mobile product page |
| `08-acquisition-demo.jpg` | Mobile demo bag after adding a size |
| `09-studio-series.jpg` | Studio Series editor |
| `10-studio-new-series.jpg` | Add Series form in Studio, before saving |
| `11-checkout-details-mobile.jpg` | Mobile delivery-details step and order summary |
| `12-demo-payment-mobile.jpg` | Clearly labelled dummy QR payment step |
| `13-order-confirmation-mobile.jpg` | Neon-backed demonstration order confirmation |
| `14-studio-orders.jpg` | Studio order ledger and fulfilment controls |
| `16-signin-desktop.jpg` | Branded customer sign-in page |
| `17-signup-desktop.jpg` | Customer archive registration page |
| `18-signup-mobile.jpg` | Mobile sign-up form with demo details |
| `19-account-empty-mobile.jpg` | New private archive before an acquisition |
| `20-account-order-mobile.jpg` | Private archive with its linked demo order |
| `23-checkout-account-gate-mobile.jpg` | Required sign-in or account creation before checkout |

Capture public pages from a local instance by default:

```powershell
python scripts/capture-screenshots.py
```

To capture the hosted site's public pages, opt in to the remote target explicitly:

```powershell
python scripts/capture-screenshots.py --base-url https://quiet-battles-demo.vercel.app --allow-remote-target
```

The default run checks public pages, the bag, responsive widths, and the account-required checkout gate without creating accounts or orders on the target. The full checkout and Studio journey creates a synthetic account and order, then removes those records. It requires a Studio key stored outside source control and an explicit mutation opt-in:

```powershell
python scripts/capture-screenshots.py --allow-demo-mutations --studio-key-file .studio-key
```

For a non-local target, add `--allow-remote-target` as well. Use a dedicated demo database. Studio order and customer evidence is cropped to the generated test record; other ledger entries are not included.
