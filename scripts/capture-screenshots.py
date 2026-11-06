"""Capture assessment screenshots and check the core visitor journey.

Optional tooling: pip install playwright && playwright install chromium
Run: python scripts/capture-screenshots.py --base-url https://quiet-battles-demo.vercel.app
"""

import argparse
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


CHAPTER_SLUGS = [
    "the-first-quiet",
    "the-weight-you-carry",
    "letting-someone-in",
    "staying-tender",
    "after-the-noise",
]


def open_route(page, base_url, route, marker):
    page.goto(f"{base_url}/#{route}", wait_until="domcontentloaded")
    page.locator(marker).wait_for(timeout=20_000)
    page.evaluate("document.fonts.ready")
    page.evaluate(
        "document.querySelectorAll('img[loading=lazy]').forEach(image => image.loading = 'eager')"
    )
    for _ in range(80):
        if page.evaluate("Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)"):
            break
        time.sleep(0.25)
    else:
        raise RuntimeError(f"Images did not finish loading on #{route}")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), route


def capture(page, output_dir, filename, full_page=True):
    page.screenshot(
        path=str(output_dir / filename),
        type="jpeg",
        quality=78,
        full_page=full_page,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://quiet-battles-demo.vercel.app")
    parser.add_argument("--output-dir", default="docs/screenshots")
    parser.add_argument("--studio-key-file", type=Path)
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        desktop = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page = desktop.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))

        open_route(page, args.base_url, "home", ".hero")
        capture(page, output_dir, "01-home-desktop.jpg")

        open_route(page, args.base_url, "archive", ".archive-list")
        assert page.locator(".archive-item").count() >= 1
        capture(page, output_dir, "02-archive-desktop.jpg")

        open_route(page, args.base_url, "series/the-gentle-armor", ".chapter-list")
        assert page.locator(".chapter-card").count() == 5
        capture(page, output_dir, "03-series-desktop.jpg")

        for slug in CHAPTER_SLUGS:
            open_route(page, args.base_url, f"chapter/{slug}", ".story-copy")
            assert page.locator(".story-copy p").count() >= 3, slug
            capture(page, output_dir, f"04-chamber-{slug}.jpg")

        open_route(page, args.base_url, "product/soft-armor-hoodie", ".product-info")
        assert page.locator(".product-gallery img").count() == 2
        capture(page, output_dir, "05-artifact-desktop.jpg")

        mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mobile_page = mobile.new_page()
        mobile_page.on("pageerror", lambda error: errors.append(str(error)))
        open_route(mobile_page, args.base_url, "home", ".hero")
        capture(mobile_page, output_dir, "06-home-mobile.jpg", full_page=False)

        open_route(mobile_page, args.base_url, "product/soft-armor-hoodie", ".product-info")
        capture(mobile_page, output_dir, "07-artifact-mobile.jpg")
        mobile_page.locator('[data-size="M"]').click()
        mobile_page.locator("[data-add]").click()
        mobile_page.locator(".cart-drawer").wait_for()
        assert "soft armor hoodie" in mobile_page.locator(".cart-drawer").inner_text().lower()
        capture(mobile_page, output_dir, "08-acquisition-demo.jpg", full_page=False)

        mobile_page.locator("[data-demo-checkout]").click()
        mobile_page.locator("#checkout-details").wait_for()
        mobile_page.locator('input[name="name"]').fill("Playwright Visitor")
        mobile_page.locator('input[name="email"]').fill("playwright@example.com")
        mobile_page.locator('input[name="phone"]').fill("+91 90000 00000")
        mobile_page.locator('input[name="city"]').fill("Bengaluru")
        mobile_page.locator('textarea[name="address"]').fill("1 Demo Archive Lane")
        mobile_page.locator('input[name="postalCode"]').fill("560001")
        capture(mobile_page, output_dir, "11-checkout-details-mobile.jpg")
        mobile_page.locator("#checkout-details button").click()
        mobile_page.locator(".payment-chamber").wait_for()
        assert "not payable" in mobile_page.locator(".payment-chamber").inner_text().lower()
        assert mobile_page.locator('.qr-frame img[alt*="Dummy QR"]').count() == 1
        capture(mobile_page, output_dir, "12-demo-payment-mobile.jpg")
        mobile_page.locator("[data-demo-ack]").check()
        mobile_page.locator("[data-confirm-demo]").click()
        mobile_page.locator(".confirmation-chamber").wait_for(timeout=20_000)
        order_number = mobile_page.locator(".confirmation-receipt strong").first.inner_text()
        assert order_number.startswith("QB-")
        assert mobile_page.locator("[data-cart-open]").inner_text().strip().endswith("(0)")
        capture(mobile_page, output_dir, "13-order-confirmation-mobile.jpg")

        if args.studio_key_file:
            studio_key = args.studio_key_file.read_text(encoding="utf8").strip()
            open_route(page, args.base_url, "admin", "#admin-login")
            page.locator('input[name="key"]').fill(studio_key)
            page.locator("#admin-login button").click()
            page.locator("#admin-form").wait_for(timeout=20_000)
            page.locator('[data-tab="series"]').click()
            assert page.locator("[data-add-series]").is_visible()
            capture(page, output_dir, "09-studio-series.jpg", full_page=False)
            page.locator("[data-add-series]").click()
            new_series = page.locator('.admin-panel[data-panel="series"] .admin-card').last
            assert "untitled series" in new_series.inner_text().lower()
            new_series.evaluate("element => element.scrollIntoView({block: 'start'})")
            page.wait_for_timeout(250)
            capture(page, output_dir, "10-studio-new-series.jpg", full_page=False)
            page.locator('[data-tab="orders"]').click()
            order_card = page.locator(".admin-order", has_text=order_number)
            order_card.wait_for(timeout=20_000)
            assert "playwright@example.com" in order_card.inner_text().lower()
            capture(page, output_dir, "14-studio-orders.jpg", full_page=False)
            order_card.locator("[data-order-status]").select_option("Confirmed")
            order_card.locator("[data-update-order]").click()
            expect(page.locator(".admin-order", has_text=order_number).locator(".order-badge")).to_have_text("Confirmed", timeout=20_000)
            page.on("dialog", lambda dialog: dialog.accept())
            page.locator(".admin-order", has_text=order_number).locator("[data-delete-order]").click()
            page.locator(".admin-order", has_text=order_number).wait_for(state="detached", timeout=20_000)
            page.locator("[data-logout]").click()

        assert not errors, f"Browser errors: {errors}"
        browser.close()

    print(f"Captured {len(list(output_dir.glob('*.jpg')))} screenshots in {output_dir}.")
    print("Browser checks passed: five Chambers, Artifact, demo bag, dummy-QR checkout, Neon order creation, responsive widths, and Studio order management.")


if __name__ == "__main__":
    main()
