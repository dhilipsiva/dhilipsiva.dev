#!/usr/bin/env python3
"""Graft the rendered site header onto public/nibli-playground/index.html.

The playground is the nibli-ui Dioxus app, fetched and compiled from the
external nibli crate (scripts/build_nibli.sh) — it cannot extend base.html,
so the shared navbar (templates/partials/nav.html) is spliced in here after
`zola build`. Donor: public/404.html, which renders the header with no
aria-current (a 404 has no current_path).

Run AFTER `zola build` (it rewrites the build output, public/). Stdlib only.
Idempotent; exits 0 when the playground was not built (local dev without the
nibli artifacts).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "public" / "nibli-playground" / "index.html"
DONOR = ROOT / "public" / "404.html"

TITLE = "<title>nibli playground — dhilipsiva</title>"
SKIP_LINK = '<a class="skip-link" href="#main">Skip to content</a>'
# The app's stylesheets are runtime-injected from wasm, after everything in
# the static head — so making room for the header (64px + 1px border) takes
# !important, scoped to the mounted root only (the app styles inner .app
# nodes too).
EXTRA_CSS = "<style>#main>.app-shell,#main>.app{height:calc(100vh - 65px)!important}</style>"


def grab(pattern: str, donor: str, what: str) -> str:
    m = re.search(pattern, donor, re.S)
    if not m:
        sys.exit(f"error: could not find {what} in {DONOR}")
    return m.group(0)


def relativize(tag: str) -> str:
    # get_url(cachebust=true) renders absolute URLs; root-relative ones work
    # on any origin (including local `zola build --base-url ...` checks).
    return re.sub(r'(href|src)="https?://[^/"]+/', r'\1="/', tag)


def main() -> int:
    if not TARGET.exists():
        print(f"skip: {TARGET.relative_to(ROOT)} not present (nibli playground not built)")
        return 0
    page = TARGET.read_text(encoding="utf-8")
    if "site-nav:start" in page:
        print("skip: site nav already injected")
        return 0
    donor = DONOR.read_text(encoding="utf-8")

    header = grab(r"<!-- site-nav:start -->.*?<!-- site-nav:end -->", donor, "site-nav markers")
    css = grab(r'<link rel="stylesheet" href="[^"]*/assets/quine\.css[^"]*">', donor, "quine.css link")
    theme = grab(r"<script>try\{if\(localStorage\.getItem\('dsiva-theme'\).*?</script>", donor, "theme pre-paint script")
    sitejs = grab(r'<script defer src="[^"]*/assets/site\.js[^"]*"></script>', donor, "site.js tag")
    css, sitejs = relativize(css), relativize(sitejs)

    # the playground IS a nibli surface — light the same nav marker /nibli/ gets
    header = header.replace('href="/nibli/"', 'href="/nibli/" aria-current="page"', 1)

    page = re.sub(r"<title>.*?</title>", TITLE, page, count=1, flags=re.S)
    page = page.replace("</head>", "\n".join([css, theme, sitejs, EXTRA_CSS]) + "\n</head>", 1)
    body = re.search(r"<body[^>]*>", page)
    if not body:
        sys.exit(f"error: no <body> in {TARGET}")
    at = body.end()
    page = page[:at] + "\n" + SKIP_LINK + "\n" + header + page[at:]
    TARGET.write_text(page, encoding="utf-8")
    print(f"injected site nav into {TARGET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
