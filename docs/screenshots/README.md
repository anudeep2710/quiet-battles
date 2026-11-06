# Assessment screenshots

These screenshots show the demonstration's main paths on desktop and mobile. `scripts/capture-screenshots.py` reproduces them with Playwright. The script does not save the Studio key or visitor data into the screenshots.

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
| `21-studio-customers.jpg` | Studio customer account management |
| `23-checkout-account-gate-mobile.jpg` | Required sign-in or account creation before checkout |

Regenerate with Python Playwright installed and the site key kept in the ignored `.studio-key` file:

```powershell
python scripts/capture-screenshots.py --base-url https://quiet-battles-demo.vercel.app --studio-key-file .studio-key
```

The capture script also opens all five Chapter Chambers and eight Artifacts, creates a temporary customer, completes and deletes its demonstration order, deletes the temporary account, updates the order status in Studio, and checks the bag and responsive layouts. It captures pages from the supplied base URL, so use the hosted URL for final submission evidence.
