#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright==1.63.0"]
# ///
"""Host-specific checks, including the shared website header and footer."""
import argparse
import json
import os
from pathlib import Path
import sys
import threading

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from rights_book import PREFIX, ROOT, csp
from preview_site import make_server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8790")
    parser.add_argument("--browser-executable")
    parser.add_argument("--nix-browser-libraries", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / ".tools/rights-book/browser")
    args = parser.parse_args()
    if args.nix_browser_libraries:
        os.environ["LD_LIBRARY_PATH"] = ":".join(
            str(path / "lib") for path in Path("/nix/store").iterdir()
            if path.is_dir() and any(name in path.name for name in ["-nss-", "-nspr-", "-alsa-lib-"])
        )
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"isolation": [], "csp_violations": [], "site_shell": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser_executable)
        report["browser"] = browser.version
        context = browser.new_context(viewport={"width": 390, "height": 844})
        context.add_init_script("""window.bookPolicyViolations = [];
            document.addEventListener('securitypolicyviolation', e =>
                window.bookPolicyViolations.push({directive:e.effectiveDirective,uri:e.blockedURI}));""")
        page = context.new_page()
        requests = []
        page.on("request", lambda request: requests.append(request.url))
        for route in ["/", "/books/", "/books/utopia-reimagined/"]:
            requests.clear()
            page.goto(args.url + route)
            page.evaluate("document.fonts.ready")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), route
            for link in page.locator(f'a[href="{PREFIX}"], a[href="{PREFIX}read/"]').all():
                link.hover()
                link.focus()
                page.wait_for_timeout(250)
            assert not [url for url in requests if PREFIX in url], requests
            assert page.locator('link[rel=prefetch],link[rel=modulepreload]').count() == 0
            report["isolation"].append(route)
        page.goto(args.url + "/books/")
        page.screenshot(path=str(args.output / "books-mobile.png"), full_page=True)
        page.set_viewport_size({"width": 1280, "height": 1000})
        page.screenshot(path=str(args.output / "books-desktop.png"), full_page=True)
        page.goto(args.url + "/books/utopia-reimagined/")
        page.screenshot(path=str(args.output / "book-detail.png"), full_page=True)

        saved_progress = {"theme": "dark", "visited": [], "step": 3,
                          "last_read": PREFIX + "read/31-the-five-joints/",
                          "positions": {PREFIX + "read/31-the-five-joints/": 1800}}
        page.evaluate("""preferences => {
            localStorage.setItem('dsiva-theme', 'light');
            localStorage.setItem('rights-book.preferences.v1', JSON.stringify(preferences));
        }""", saved_progress)
        requests.clear()
        response = page.goto(args.url + PREFIX + "read/")
        assert response.headers["content-security-policy"] == csp(ROOT / "public" / PREFIX.strip("/"))
        expect(page.locator("#book-app")).to_have_attribute("data-ready", "true")
        assert not [url for url in requests if "/engine/" in url or "engine-worker" in url]
        expect(page.locator('html')).to_have_attribute('data-theme', 'light')
        expect(page.locator('.theme-toggle')).to_have_attribute('aria-pressed', 'true')
        for width in [390, 1280]:
            page.set_viewport_size({"width": width, "height": 844})
            for theme in ['dark', 'light']:
                if page.locator('html').get_attribute('data-theme') != theme:
                    page.locator('.theme-toggle').click()
                expect(page.locator('html')).to_have_attribute('data-theme', theme)
                expect(page.locator('.theme-toggle')).to_have_attribute('aria-pressed', str(theme == 'light').lower())
                assert page.evaluate("localStorage.getItem('dsiva-theme')") == theme
                preferences = page.evaluate("JSON.parse(localStorage.getItem('rights-book.preferences.v1'))")
                assert preferences == {**saved_progress, 'theme': theme}, preferences
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                expect(page.locator('body > .site-header')).to_have_count(1)
                expect(page.locator('body > .site-footer')).to_have_count(1)
                expect(page.locator('#main .site-header, #main .site-footer')).to_have_count(0)
                expect(page.locator('.site-header a[href="/books/"]')).to_have_attribute('aria-current', 'page')
                page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
                page.screenshot(path=str(args.output / f'book-header-{theme}-{width}.png'))
                page.locator('.site-footer').screenshot(path=str(args.output / f'book-footer-{theme}-{width}.png'))
                report['site_shell'].append({'width': width, 'theme': theme})
        page.get_by_role('button', name='Switch colour theme').click()
        expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
        expect(page.locator('.theme-toggle')).to_have_attribute('aria-pressed', 'false')
        assert page.evaluate("localStorage.getItem('dsiva-theme')") == 'dark'
        page.reload()
        expect(page.locator('#book-app')).to_have_attribute('data-ready', 'true')
        expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
        page.keyboard.press('Tab')
        expect(page.locator('.site-skip-link')).to_be_focused()
        page.keyboard.press('Enter')
        expect(page.locator('#main-content')).to_be_focused()
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('.nav-toggle').click()
        expect(page.locator('.site-header .nav')).to_be_visible()
        page.locator('.site-header a[href="/books/"]').click()
        expect(page).to_have_url(args.url + '/books/')
        expect(page.locator('.theme-toggle')).to_have_attribute('aria-pressed', 'false')
        page.locator('.theme-toggle').click()
        page.goto(args.url + PREFIX + 'read/')
        expect(page.locator('#book-app')).to_have_attribute('data-ready', 'true')
        expect(page.locator('html')).to_have_attribute('data-theme', 'light')
        report["csp_violations"] += page.evaluate("window.bookPolicyViolations")
        page.goto(args.url + PREFIX + "search/")
        expect(page.locator("#book-app")).to_have_attribute("data-ready", "true")
        page.get_by_role("searchbox").fill("வீழ்வே")
        expect(page.locator(".search-results li").first).to_be_visible()
        report["csp_violations"] += page.evaluate("window.bookPolicyViolations")

        page.goto(args.url + PREFIX)
        expect(page.locator(".game")).to_have_attribute("data-phase", "ready", timeout=90000)
        page.locator(".move-button").click()
        expect(page.locator('[data-case="nell:0"]')).to_be_visible(timeout=90000)
        report["csp_violations"] += page.evaluate("window.bookPolicyViolations")
        assert not report["csp_violations"], report["csp_violations"]
        context.close()
        # Shared navigation and the complete reader also work without JS.
        context = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
        page = context.new_page()
        page.goto(args.url + PREFIX + 'read/epigraph/')
        expect(page.locator('.site-header .brand')).to_be_visible()
        page.locator('.nav-toggle').click()
        expect(page.locator('.site-header a[href="/books/"]')).to_be_visible()
        page.locator('.nav-toggle').click()
        page.locator('.site-footer a[href="/books/"]').click()
        expect(page).to_have_url(args.url + '/books/')
        context.close()
        print("PASS: shared header/footer, theme persistence, keyboard, mobile/no-JS navigation, isolation and CSP", flush=True)

        # Serve actual gzip-encoded HTTP, so the browser does the decoding.
        # Avoid moving the 127 MB decoded buffer through the debug protocol.
        server = make_server(ROOT / "public", 0, gzip_encoding=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            context = browser.new_context()
            page = context.new_page()
            gzip_headers = []
            page.on("response", lambda response: gzip_headers.append(response.headers)
                    if response.url.endswith("constitution.bin.gz") else None)
            page.goto(f"http://127.0.0.1:{server.server_port}" + PREFIX)
            expect(page.locator(".game")).to_have_attribute("data-phase", "ready", timeout=90000)
            assert gzip_headers[0]["content-encoding"] == "gzip"
            page.locator(".move-button").click()
            expect(page.locator('[data-case="nell:0"]')).to_be_visible(timeout=90000)
            report["gzip"] = ["raw gzip resource", "browser-decoded Content-Encoding: gzip"]
            context.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
        browser.close()
    (args.output / "host-results.json").write_text(json.dumps(report, indent=2) + "\n")
    print("PASS: host resource isolation, discovery links, CSP, Tamil and both gzip representations")


if __name__ == "__main__":
    main()
