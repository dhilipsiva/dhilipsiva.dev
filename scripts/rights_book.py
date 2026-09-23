#!/usr/bin/env python3
"""Validate/mount the untouched Book 1 artifact and export unapplied edge rules."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "/rights-nobody-has-to-earn/"
HOST = "dhilipsiva.dev"
SCOPE = f'(http.host eq "{HOST}" and starts_with(http.request.uri.path, "{PREFIX}"))'
CACHE_CONTROL = "no-cache, max-age=0, must-revalidate"
MIME_TYPES = {
    ".wasm": "application/wasm",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".gz": "application/gzip",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
}
SITE_PARTS = ("head-start", "head-end", "header", "footer")


def site_block(part, contents):
    return f"<!-- book-site-{part}:start -->\n{contents}\n<!-- book-site-{part}:end -->"


def original_html(page):
    """Remove only the four delimited additions, leaving every upstream byte."""
    counts = []
    for part in SITE_PARTS:
        page, count = re.subn(
            rf"<!-- book-site-{part}:start -->.*?<!-- book-site-{part}:end -->",
            "", page, flags=re.S,
        )
        counts.append(count)
    if counts not in ([0] * len(SITE_PARTS), [1] * len(SITE_PARTS)):
        raise ValueError("Incomplete or duplicate book site shell")
    return page


def compare_artifact(source, assembled):
    """Require identical exports/assets and lossless HTML shell additions."""
    before, after = inventory(source), inventory(assembled)
    if before.keys() != after.keys():
        raise ValueError("Assembled book has missing or unexpected files")
    for name in before:
        if before[name] == after[name]:
            continue
        if (not name.endswith(".html")
                or original_html((assembled / name).read_bytes().decode("utf-8")).encode("utf-8")
                != (source / name).read_bytes()):
            raise ValueError(f"Assembled book changes upstream content: {name}")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def local_path(url):
    parts = urlsplit(url)
    if (parts.scheme or parts.netloc or not parts.path.startswith(PREFIX)
            or any(p in {".", ".."} for p in parts.path.split("/"))
            or any(c in url for c in "\r\n\\%")):
        raise ValueError(f"Invalid book path: {url!r}")
    return parts


def redirects(book):
    manifest = read_json(book / "redirects.json")
    if manifest.get("version") != 1 or len(manifest["redirects"]) != 3:
        raise ValueError("Expected version 1 manifest with three redirects")
    seen = set()
    for rule in manifest["redirects"]:
        source, target = local_path(rule["from"]), local_path(rule["to"])
        if (source.query or source.fragment or target.query or rule["status"] != 301
                or source.path in seen or not source.path.endswith("/")):
            raise ValueError(f"Invalid redirect: {rule}")
        seen.add(source.path)
    return manifest["redirects"]


def inventory(book):
    if book.is_symlink() or not book.is_dir():
        raise ValueError(f"Not a real artifact directory: {book}")
    files = {}
    for path in sorted(book.rglob("*")):
        relative = path.relative_to(book)
        if path.is_symlink():
            raise ValueError(f"Symlink in public artifact: {relative}")
        if (any(p.startswith(".") or p in {"artifacts", "tests", "target", "generated", "reports"}
                for p in relative.parts)
                or path.suffix.lower() in {".zip", ".exe"}
                or path.name in {"expectations.json", "source-execution.json"}):
            raise ValueError(f"Private file in public artifact: {relative}")
        if path.is_file():
            files[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def validate(book):
    files = inventory(book)
    required = {
        "index.html", "index.md", "read/index.html", "search/index.html", "404.html",
        "content.json", "game.json", "cases.json", "redirects.json", "sitemap.xml",
        "llms.txt", "llms-full.txt", "assets/platform.js", "assets/engine-worker.js",
        "assets/fonts.css", "assets/quine.css", "assets/app.css",
        "assets/app/rights_book_ui.js", "assets/app/rights_book_ui_bg.wasm",
        "assets/engine/book_reason.js", "assets/engine/book_reason_bg.wasm",
        "assets/engine/constitution.bin.gz",
    }
    required.update(f"assets/licences/{name}" for name in
                    ["LICENSE-MIT", "LICENSE-APACHE", "LICENSING.md", "LICENSE-CC-BY", "LICENSE-CC0"])
    required.update(f"assets/fonts/{name}" for name in [
        "PlexSerif.ttf", "PlexSerif-Italic.ttf", "PlexSans.ttf", "PlexMono.ttf",
        "NotoSerifTamil.ttf", "SpaceGrotesk.ttf", "OFL-PlexSerif.txt", "OFL-PlexSans.txt",
        "OFL-PlexMono.txt", "OFL-NotoSerifTamil.txt", "OFL-SpaceGrotesk.txt",
    ])
    if missing := required - files.keys():
        raise ValueError(f"Missing artifacts: {sorted(missing)}")
    if empty := [name for name in required if (book / name).stat().st_size == 0]:
        raise ValueError(f"Empty artifacts: {sorted(empty)}")
    for name in required:
        if name.endswith(".wasm") and (book / name).read_bytes()[:4] != b"\0asm":
            raise ValueError(f"Invalid Wasm artifact: {name}")
    html = {name for name in files if name.endswith(".html")}
    routes = {"index.html", "read/index.html", "search/index.html"}
    content = read_json(book / "content.json")
    if len(content["pages"]) != 34:
        raise ValueError("Expected 34 reading inputs")
    for page in content["pages"]:
        url = urlsplit(page["canonical"])
        if url.scheme != "https" or url.netloc != HOST or url.query or url.fragment:
            raise ValueError(f"Invalid canonical: {page['canonical']}")
        path = local_path(url.path).path.removeprefix(PREFIX)
        routes.add(path + "index.html")
    if len(routes) != 37 or html != routes | {"404.html"}:
        raise ValueError("Expected exactly 37 HTML routes and a separate 404 document")
    for route in routes:
        if str(Path(route).with_suffix(".md")) not in files:
            raise ValueError(f"Missing Markdown alternate: {route}")
    for rule in redirects(book):
        target = local_path(rule["to"]).path.removeprefix(PREFIX) + "index.html"
        if target not in routes:
            raise ValueError(f"Redirect target is absent: {rule}")
    if (book / "assets/engine/constitution.bin.gz").read_bytes()[:2] != b"\x1f\x8b":
        raise ValueError("Invalid constitution gzip")
    return {"routes": 37, "reading_inputs": 34, "error_documents": 1, "files": len(files),
            "engine_revision": read_json(book / "cases.json")["engine_revision"]}


class InlineScripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.current = None
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and "src" not in dict(attrs):
            self.current = []

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.current is not None:
            self.scripts.append("".join(self.current))
            self.current = None


def csp(book):
    hashes = set()
    for path in sorted(book.rglob("*.html")):
        parser = InlineScripts()
        parser.feed(path.read_text(encoding="utf-8"))
        for script in parser.scripts:
            digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
            hashes.add(f"'sha256-{digest}'")
    if not hashes:
        raise ValueError("No inline scripts found; refusing an empty CSP proposal")
    return "; ".join([
        "default-src 'none'",
        "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' " + " ".join(sorted(hashes)),
        "style-src 'self' 'unsafe-inline'", "font-src 'self'", "img-src 'self' data:",
        "connect-src 'self'", "worker-src 'self'", "base-uri 'self'",
        "form-action 'self'", "frame-ancestors 'self'", "object-src 'none'",
    ])


def ruleset(phase, rules):
    return {"name": "Book 1 proposal — UNAPPLIED", "kind": "zone", "phase": phase, "rules": rules}


def edge_proposals(book):
    redirect_rules = [{
        "ref": f"rights_book_redirect_{i}", "description": f"Book 1: {rule['from']}",
        "expression": f'(http.host eq "{HOST}" and http.request.uri.path eq "{rule["from"]}" '
                      'and http.request.method in {"GET" "HEAD"})',
        "action": "redirect", "action_parameters": {"from_value": {
            "target_url": {"value": f"https://{HOST}{rule['to']}"},
            "status_code": 301, "preserve_query_string": True}}, "enabled": False,
    } for i, rule in enumerate(redirects(book), 1)]
    headers = [{
        "ref": "rights_book_policy", "description": "Book 1 CSP and browser revalidation",
        "expression": SCOPE, "action": "rewrite", "enabled": False,
        "action_parameters": {"headers": {
            "content-security-policy": {"operation": "set", "value": csp(book)},
            "cache-control": {"operation": "set", "value": CACHE_CONTROL},
            "x-content-type-options": {"operation": "set", "value": "nosniff"},
        }},
    }]
    for suffix in [".wasm", ".js", ".mjs", ".json", ".md", ".gz"]:
        headers.append({
            "ref": "rights_book_mime_" + suffix[1:], "description": f"Book 1 {suffix} MIME",
            "expression": f'{SCOPE} and ends_with(http.request.uri.path, "{suffix}") and http.response.code eq 200',
            "action": "rewrite", "enabled": False, "action_parameters": {"headers": {
                "content-type": {"operation": "set", "value": MIME_TYPES[suffix]},
            }},
        })
    cache = [{
        "ref": "rights_book_cache_bypass", "description": "Revalidate unversioned Book 1 resources",
        "expression": SCOPE, "action": "set_cache_settings", "enabled": False,
        "action_parameters": {"cache": False, "browser_ttl": {"mode": "respect_origin"}},
    }]
    return {
        "redirects.json": ruleset("http_request_dynamic_redirect", redirect_rules),
        "response-headers.json": ruleset("http_response_headers_transform", headers),
        "cache.json": ruleset("http_request_cache_settings", cache),
    }


def export_edge(book, output, revision):
    summary = validate(book)
    output.mkdir(parents=True, exist_ok=True)
    for name, value in edge_proposals(book).items():
        (output / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    summary.update(book_revision=revision, applied=False)
    (output / "artifact.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))


def mount(book, destination):
    validate(book)
    if destination.is_symlink():
        raise ValueError("Refusing to replace a symlink mount")
    if (book.resolve() == destination.resolve() or destination.resolve() in book.resolve().parents
            or book.resolve() in destination.resolve().parents):
        raise ValueError("Artifact must be outside the destination")
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Stage on the destination filesystem; preserve the old tree if staging fails.
    with tempfile.TemporaryDirectory(prefix=".rights-book-", dir=destination.parent) as temp:
        stage, previous = Path(temp) / "new", Path(temp) / "previous"
        shutil.copytree(book, stage)
        validate(stage)
        if inventory(book) != inventory(stage):
            raise ValueError("Staged artifact differs from source")
        if destination.exists():
            destination.rename(previous)
        try:
            stage.rename(destination)
        except BaseException:
            if previous.exists():
                previous.rename(destination)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["mount", "edge", "check"])
    parser.add_argument("artifact", type=Path)
    parser.add_argument("--revision", default="local-artifact-unverified")
    parser.add_argument("--destination", type=Path, default=ROOT / "static" / PREFIX.strip("/"))
    parser.add_argument("--edge-output", type=Path, default=ROOT / ".tools/rights-book/edge")
    parser.add_argument("--compare", type=Path, help="Compare all files, allowing only the marked site shell")
    args = parser.parse_args()
    summary = validate(args.artifact)
    if args.command == "mount":
        # Generate policy before replacing the current mount as well.
        export_edge(args.artifact, args.edge_output, args.revision)
        mount(args.artifact, args.destination)
    elif args.command == "edge":
        export_edge(args.artifact, args.edge_output, args.revision)
    else:
        if args.compare:
            compare_artifact(args.artifact, args.compare)
        print(json.dumps(summary))


if __name__ == "__main__":
    main()
