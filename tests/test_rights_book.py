"""Integration checks against the actual Book 1 artifact (stdlib only)."""
import http.client
from html import unescape
from pathlib import Path
import re
import shutil
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from preview_site import make_server
from rights_book import CACHE_CONTROL, HOST, PREFIX, ROOT, compare_artifact, csp, edge_proposals, inventory, mount, validate


class BookIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.book = ROOT / "static" / PREFIX.strip("/")
        cls.assembled = ROOT / "public" / PREFIX.strip("/")
        validate(cls.book)
        cls.server = make_server(ROOT / "public", 0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path, method="GET"):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request(method, path)
        response = connection.getresponse()
        result = response.status, {name.title(): value for name, value in response.getheaders()}, response.read()
        connection.close()
        return result

    def test_site_shell_preserves_every_artifact(self):
        compare_artifact(self.book, self.assembled)
        donor = (ROOT / "public/404.html").read_text()
        header = re.search(r"<!-- site-nav:start -->.*?<!-- site-nav:end -->", donor, re.S)[0]
        header = header.replace('href="/books/"', 'href="/books/" aria-current="page"', 1)
        footer = re.search(r"<!-- site-footer:start -->.*?<!-- site-footer:end -->", donor, re.S)[0]
        pages = list(self.assembled.rglob("*.html"))
        self.assertEqual(len(pages), 38)
        for path in pages:
            page = path.read_text()
            self.assertEqual(page.count(header), 1, path)
            self.assertEqual(page.count(footer), 1, path)
            self.assertEqual(page.count('id="main"'), 1, path)
            self.assertLess(page.index(header), page.index('id="main"'))
            self.assertGreater(page.index(footer), page.index("</main>"))
            self.assertIn('class="site-skip-link" href="#main-content"', page)
            self.assertIn('/assets/rights-book-host.js?v=', page)
            self.assertLess(page.index('/assets/quine.css?'), page.index(PREFIX + 'assets/app.css'))
        self.assertEqual(self.request(PREFIX)[1]["Content-Security-Policy"], csp(self.assembled))

    def test_comparison_rejects_content_changes_inside_site_shell(self):
        with tempfile.TemporaryDirectory() as temp:
            copy = Path(temp) / "book"
            shutil.copytree(self.assembled, copy)
            index = copy / "index.html"
            page = index.read_text()
            index.write_text(page.replace('id="book-app"', 'id="broken-app"', 1))
            with self.assertRaisesRegex(ValueError, "upstream content: index.html"):
                compare_artifact(self.book, copy)
            index.write_text(page.replace('<!-- book-site-footer:end -->', '', 1))
            with self.assertRaisesRegex(ValueError, "Incomplete or duplicate"):
                compare_artifact(self.book, copy)

    def test_redirects_preserve_raw_query_before_fragment(self):
        for source, target in [("map/", PREFIX), ("walkthrough/food-delivery/", PREFIX),
                               ("about/", PREFIX + "#dossier")]:
            for method in ["GET", "HEAD"]:
                for query in ["", "?", "?q=a%20b%26c%23d", "?x=1&x=2&empty=&flag", "?q=%E0%AE%A4+%2B"]:
                    with self.subTest(source=source, method=method, query=query):
                        status, headers, body = self.request(PREFIX + source + query, method)
                        expected = target.replace("#dossier", "")
                        expected += query if query != "?" else ""
                        if "#dossier" in target:
                            expected += "#dossier"
                        self.assertEqual((status, headers["Location"], body), (301, expected, b""))

    def test_redirect_scope(self):
        self.assertEqual(self.request(PREFIX + "about/", "POST")[0], 501)
        self.assertEqual(self.request(PREFIX + "about/child/")[0], 404)
        self.assertEqual(self.request("/map/")[0], 404)
        self.assertEqual(self.request("/about/")[0], 200)
        rules = edge_proposals(self.book)["redirects.json"]["rules"]
        self.assertEqual(len(rules), 3)
        for rule in rules:
            self.assertIn(f'http.host eq "{HOST}"', rule["expression"])
            self.assertIn('http.request.uri.path eq ', rule["expression"])
            self.assertIn('http.request.method in {"GET" "HEAD"}', rule["expression"])
            self.assertTrue(rule["action_parameters"]["from_value"]["preserve_query_string"])
            self.assertFalse(rule["enabled"])
        self.assertEqual(rules[-1]["action_parameters"]["from_value"]["target_url"]["value"],
                         "https://dhilipsiva.dev" + PREFIX + "#dossier")

    def test_directory_navigation_and_head(self):
        for route in [PREFIX.rstrip("/"), PREFIX + "read", PREFIX + "read/epigraph"]:
            for method in ["GET", "HEAD"]:
                status, headers, body = self.request(route + "?x=1&x=2", method)
                self.assertEqual(status, 301)
                self.assertEqual(headers["Location"], route + "/?x=1&x=2")
                self.assertEqual(body, b"")
        status, headers, body = self.request(PREFIX + "read/epigraph/", "HEAD")
        self.assertEqual(status, 200)
        self.assertGreater(int(headers["Content-Length"]), 0)
        self.assertEqual(body, b"")

    def test_real_404s_and_no_listings(self):
        for path in ["missing/", "assets/missing.js", "assets/", "assets/../index.html", "%2e%2e/config.toml"]:
            for method in ["GET", "HEAD"]:
                status, headers, body = self.request(PREFIX + path, method)
                self.assertEqual(status, 404, path)
                self.assertEqual(headers["Content-Type"], "text/html; charset=utf-8")
                self.assertEqual(body, b"" if method == "HEAD" else (self.assembled / "404.html").read_bytes())
        status, headers, body = self.request("/missing-website-page/")
        self.assertEqual(status, 404)
        self.assertEqual(body, (ROOT / "public/404.html").read_bytes())
        self.assertNotIn("Content-Security-Policy", headers)

    def test_asset_headers_and_gzip_resource(self):
        for path, mime in {
            "assets/app/rights_book_ui_bg.wasm": "application/wasm",
            "assets/engine-worker.js": "text/javascript; charset=utf-8",
            "content.json": "application/json; charset=utf-8",
            "read/epigraph/index.md": "text/markdown; charset=utf-8",
            "assets/engine/constitution.bin.gz": "application/gzip",
        }.items():
            status, headers, body = self.request(PREFIX + path)
            self.assertEqual(status, 200)
            self.assertEqual(headers["Content-Type"], mime)
            self.assertEqual(headers["Cache-Control"], CACHE_CONTROL)
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
            self.assertEqual(body, (self.book / path).read_bytes())
            self.assertNotIn("Content-Encoding", headers)
        self.assertNotIn("Content-Security-Policy", self.request("/")[1])

    def test_complete_replacement_and_failure_preserves_previous_mount(self):
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / "book"
            mount(self.book, destination)
            stale = destination / "stale.txt"
            stale.write_text("old generation")
            with patch("rights_book.shutil.copytree", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    mount(self.book, destination)
            self.assertEqual(stale.read_text(), "old generation")
            mount(self.book, destination)
            self.assertFalse(stale.exists())
            self.assertEqual(inventory(self.book), inventory(destination))

    def test_missing_artifacts_and_private_files_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "source"
            shutil.copytree(self.book, source)
            (source / "assets/engine/book_reason_bg.wasm").unlink()
            with self.assertRaisesRegex(ValueError, "Missing artifacts"):
                validate(source)
            (source / "expectations.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "Private file"):
                validate(source)

    def test_discovery(self):
        for path in ["/books/", "/books/utopia-reimagined/"]:
            status, _, body = self.request(path)
            self.assertEqual(status, 200)
            html = unescape(body.decode())
            self.assertIn("The Rights Nobody Has to Earn", html)
            self.assertIn(f'href="{PREFIX}"', html)
            self.assertIn(f'href="{PREFIX}read/"', html)
            self.assertNotIn("Utopia, Reimagined", html)
        self.assertIn(("https://" + HOST + PREFIX + "sitemap.xml").encode(), self.request("/robots.txt")[2])
        discovery = self.request("/llms.txt")[2].decode()
        for suffix in ["", "read/", "llms.txt", "content.json"]:
            self.assertIn("https://" + HOST + PREFIX + suffix, discovery)


if __name__ == "__main__":
    unittest.main()
