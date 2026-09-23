#!/usr/bin/env python3
"""Serve assembled Zola output with Book 1 redirects, proposed headers and 404s.

Local preview only. GitHub Pages still uses its site-wide production 404.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit

from rights_book import CACHE_CONTROL, MIME_TYPES, PREFIX, ROOT, csp, redirects, validate


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, policy, manifest, gzip_encoding=False, **kwargs):
        self.policy, self.manifest = policy, manifest
        self.gzip_encoding = gzip_encoding
        super().__init__(*args, **kwargs)

    def is_book(self):
        path = unquote(urlsplit(self.path).path)
        return path == PREFIX.rstrip("/") or path.startswith(PREFIX)

    def end_headers(self):
        if self.is_book():
            self.send_header("Content-Security-Policy", self.policy)
            self.send_header("Cache-Control", CACHE_CONTROL)
            self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def guess_type(self, path):
        return MIME_TYPES.get(Path(path).suffix.lower()) or super().guess_type(path)

    def send_head(self):
        requested = urlsplit(self.path)
        for rule in self.manifest:
            if requested.path == rule["from"]:
                target = urlsplit(rule["to"])
                return self.redirect(urlunsplit(("", "", target.path, requested.query, target.fragment)))
        # Reject traversal and symlink escapes; never expose directory listings.
        if any(p in {".", ".."} for p in unquote(requested.path).split("/")):
            self.send_error(404)
            return None
        path = Path(self.translate_path(self.path))
        if not path.resolve().is_relative_to(Path(self.directory).resolve()):
            self.send_error(404)
            return None
        if path.is_dir():
            if not (path / "index.html").is_file():
                self.send_error(404)
                return None
            if not requested.path.endswith("/"):
                return self.redirect(urlunsplit(("", "", requested.path + "/", requested.query, "")))
        if self.gzip_encoding and self.is_book() and path.suffix == ".gz" and path.is_file():
            # Optional local check of the browser's transparent HTTP decoding.
            # Send the original compressed bytes, with matching HTTP metadata.
            stream = path.open("rb")
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(path.stat().st_size))
            self.end_headers()
            return stream
        return super().send_head()

    def redirect(self, location):
        self.send_response(301)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()
        return None

    def send_error(self, code, message=None, explain=None):
        error = Path(self.directory) / (PREFIX.strip("/") if self.is_book() else "") / "404.html"
        if code == 404 and error.is_file():
            body = error.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
        else:
            super().send_error(code, message, explain)

    def log_message(self, *_):
        pass


def make_server(directory, port, gzip_encoding=False):
    directory = directory.resolve()
    book = directory / PREFIX.strip("/")
    validate(book)
    handler = partial(Handler, directory=str(directory), policy=csp(book), manifest=redirects(book),
                      gzip_encoding=gzip_encoding)
    return ThreadingHTTPServer(("127.0.0.1", port), handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=ROOT / "public")
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--gzip-encoding", action="store_true",
                        help="Test browser HTTP decompression of the supplied .gz resource")
    args = parser.parse_args()
    server = make_server(args.directory, args.port, args.gzip_encoding)
    print(f"Local preview with proposed CSP: http://127.0.0.1:{server.server_port}{PREFIX}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
