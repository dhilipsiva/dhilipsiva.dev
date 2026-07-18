#!/usr/bin/env python3
"""Graft the rendered site header onto the Dioxus-built app pages.

The playground apps (nibli-ui → /nibli-playground/, voksa-console-demo →
/voksa/) are fetched and compiled from external crates (scripts/build_*.sh) —
they cannot extend base.html, so the shared navbar (templates/partials/nav.html)
is spliced in here after `zola build`. Donor: public/404.html, which renders the
header with no aria-current (a 404 has no current_path).

Run AFTER `zola build` (it rewrites the build output, public/). Stdlib only.
Idempotent; skips any app that was not built (local dev without the artifacts).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DONOR = ROOT / "public" / "404.html"
SKIP_LINK = '<a class="skip-link" href="#main">Skip to content</a>'

# Each Dioxus app grafted post-build: output dir under public/, its <title>, the
# nav link to light with aria-current, and any app-specific head CSS.
APPS = [
    {
        "dir": "nibli-playground",
        "title": "nibli playground — dhilipsiva",
        "active": "/nibli/",
        # App fills a fixed-height shell; make room for the 64px + 1px header.
        # !important because the app injects its own styles from wasm, last.
        "extra_css": "<style>#main>.app-shell,#main>.app{height:calc(100vh - 65px)!important}</style>",
    },
    {
        "dir": "voksa",
        "title": "voksa — the tuning console — dhilipsiva",
        "active": "/voksa/",
        # The console is a normal scrolling document (non-sticky title row) that
        # flows below the sticky header — no height clamp.
        "extra_css": "",
    },
    {
        "dir": "silicon-eras",
        "title": "silicon·eras — hardware history, 1975–2026 — dhilipsiva",
        # Not a top-nav item — reached from a musing, so light "Musings" (mirrors
        # nibli-playground lighting /nibli/). No /silicon-eras/ nav link exists.
        "active": "/musings/",
        # The explorable's root is min-height:100vh — a normal scrolling document
        # that flows below the sticky header (like voksa) — no height clamp.
        "extra_css": "",
    },
]


def grab(pattern, donor, what):
    m = re.search(pattern, donor, re.S)
    if not m:
        sys.exit(f"error: could not find {what} in {DONOR}")
    return m.group(0)


def relativize(tag):
    # get_url(cachebust=true) renders absolute URLs; root-relative ones work
    # on any origin (including local `zola build --base-url ...` checks).
    return re.sub(r'(href|src)="https?://[^/"]+/', r'\1="/', tag)


def inject(app, header, head_bits):
    target = ROOT / "public" / app["dir"] / "index.html"
    if not target.exists():
        print(f"skip: {target.relative_to(ROOT)} not present ({app['dir']} not built)")
        return
    page = target.read_text(encoding="utf-8")
    if "site-nav:start" in page:
        print(f"skip: site nav already injected in {app['dir']}")
        return

    # light the same nav marker the app's live surface gets
    hdr = header.replace(
        f'href="{app["active"]}"', f'href="{app["active"]}" aria-current="page"', 1
    )
    bits = head_bits + ([app["extra_css"]] if app["extra_css"] else [])

    page = re.sub(r"<title>.*?</title>", f"<title>{app['title']}</title>", page, count=1, flags=re.S)
    page = page.replace("</head>", "\n".join(bits) + "\n</head>", 1)
    body = re.search(r"<body[^>]*>", page)
    if not body:
        sys.exit(f"error: no <body> in {target}")
    at = body.end()
    page = page[:at] + "\n" + SKIP_LINK + "\n" + hdr + page[at:]
    target.write_text(page, encoding="utf-8")
    print(f"injected site nav into {target.relative_to(ROOT)}")


def main():
    donor = DONOR.read_text(encoding="utf-8")
    header = grab(r"<!-- site-nav:start -->.*?<!-- site-nav:end -->", donor, "site-nav markers")
    css = grab(r'<link rel="stylesheet" href="[^"]*/assets/quine\.css[^"]*">', donor, "quine.css link")
    theme = grab(r"<script>try\{if\(localStorage\.getItem\('dsiva-theme'\).*?</script>", donor, "theme pre-paint script")
    sitejs = grab(r'<script defer src="[^"]*/assets/site\.js[^"]*"></script>', donor, "site.js tag")
    head_bits = [relativize(css), theme, relativize(sitejs)]
    for app in APPS:
        inject(app, header, head_bits)
    return 0


if __name__ == "__main__":
    sys.exit(main())
