# Book 1 website integration

The website remains Zola → GitHub Pages → Cloudflare. Book 1 is a standalone
Dioxus section at `/rights-nobody-has-to-earn/`, assembled into the same Pages
artifact as the other external apps, with the website's shared header and footer.
This preparation has not deployed anything
or changed Cloudflare. `source` is the deployment branch; pushing it triggers
the existing production workflow.

## Build and preview

Requirements: Python 3.11+, uv, Git, Rust with `wasm32-unknown-unknown`, and
Zola 0.22.1. The book build installs its exact wasm-bindgen CLI privately under
`.tools/rights-book/`; it does not replace a global CLI or another app's engine.

```sh
rustup target add wasm32-unknown-unknown
bash scripts/build_rights_book.sh
zola build --base-url http://127.0.0.1:8790
python3 scripts/gen_llms_txt.py
python3 scripts/inject_nav.py
python3 scripts/preview_site.py
```

Open <http://127.0.0.1:8790/rights-nobody-has-to-earn/> or the
[complete reader](http://127.0.0.1:8790/rights-nobody-has-to-earn/read/).
The local base URL keeps the surrounding website's styles and scripts on the
preview origin. Book canonical URLs remain `https://dhilipsiva.dev`, as supplied.
For a production artifact, run `zola build` without the local base override.

The other external apps can be built using their existing `scripts/build_*.sh`
commands. Their absent local artifacts do not prevent the website/book preview;
the deployment workflow still builds them all. Use this preview server for book
acceptance: Zola's ordinary server does not implement the manifest or edge policy.

The default fetches the book repository's `main` into a temporary directory,
fetches its exact `engine.pin` into an isolated sibling `nibli` checkout, and
runs `python3 ui/scripts/build.py web`. No constitutional sources are edited and
`verify.sh` is not run. There is no execution-result reuse or answer precomputation.
The engine compilation prepares inputs. To select a revision:

```sh
RIGHTS_BOOK_REF=dbfab823b64456a0211daf958ddb6424b18cbd1c bash scripts/build_rights_book.sh
```

`RIGHTS_BOOK_REPO` can select another trusted checkout or repository. A local
artifact override needs no Rust compilation:

```sh
RIGHTS_BOOK_ARTIFACT_DIR=/path/to/book/ui/dist/rights-nobody-has-to-earn \
RIGHTS_BOOK_ARTIFACT_REVISION=dbfab823b64456a0211daf958ddb6424b18cbd1c \
bash scripts/build_rights_book.sh
```

Use the **section directory**, not `ui/dist` or `ui/artifacts`. Revision metadata
for an override is a caller-supplied label, not an assertion that it was rebuilt.
Without the label it is recorded as `local-artifact-unverified`.

All 121 public files are copied into `static/` without modification. Staging
completes and is compared byte for byte before the previous generated directory is replaced.
Missing exports, fonts, licenses, routes or engine resources fail the build;
private reports, expectations, native ZIPs and symlinks are rejected. The checks
currently expect 37 routes and 34 reading inputs, so an intentional upstream
change to that contract requires updating the website integration as well.
After Zola builds, `scripts/inject_nav.py` adds the rendered shared header and
footer from `public/404.html` to all 37 routes and the book's error document.
The footer comes from `templates/partials/footer.html`, also used by the website.
The additions sit outside Dioxus's `#main` root. Removing the four marked host
blocks recovers the original HTML exactly; every other artifact remains byte
identical. The book's metadata, hydration tree and own navigation stay intact.
Repeating injection refreshes the shared markup without adding duplicate shells.

The website stylesheet loads before the book styles. The host stylesheet offsets
sticky reader navigation and fragment targets below the site header. The host
script adopts the website theme before hydration while preserving saved progress;
after hydration, the site theme button invokes the book's own theme control.
Both controls update the shared preference. These host assets load only on book
documents; links elsewhere remain ordinary anchors with no book prefetching.

## Local verification

```sh
python3 scripts/rights_book.py check static/rights-nobody-has-to-earn \
  --compare public/rights-nobody-has-to-earn
python3 -m unittest discover -s tests -p 'test_rights_book.py' -v
python3 scripts/check_rights_book_browser.py --book-checkout /path/to/book
```

The last command requires the preview to be running and Chromium available to
Playwright 1.63.0. Install its browser with
`uv run --with playwright==1.63.0 playwright install chromium`, or pass
`--browser-executable /path/to/chromium`. On this Nix host,
`--nix-browser-libraries` supplies the installed browser's runtime libraries.
The runner reads the versioned tests from the actual integrated commit using
`git show`; it never modifies the book checkout. The private copy changes one
keyboard selector: the first Tab now focuses the host's skip link, which must
still focus the same book main element when activated. All other assertions are
unchanged. It runs the full upstream
acceptance suite, including all 78 worker records against development
expectations, then host-specific checks. It does not rerun the native
source/compiled comparison or the constitutional verifier. `--skip-reasoning`
retains the UI, reading, live gameplay and failure checks while omitting the
78-record engine sweep, useful for changes confined to website chrome.

Reports and screenshots stay in ignored `.tools/rights-book/acceptance/ui/artifacts/browser/`
and `.tools/rights-book/browser/`, outside `static/` and `public/`. Every website
build generates a fresh proposal and integrated commit metadata in
`.tools/rights-book/edge/`; injection refreshes the proposal from the final HTML.
The deployment workflow checks unchanged assets and lossless HTML additions
and HTTP integration tests before uploading its single Pages artifact.

## Unapplied Cloudflare proposals

The reviewable exports in [rights-book/cloudflare](rights-book/cloudflare/) were
generated from the integrated artifact. All exported rules have
`enabled: false`, and no apply script is supplied. Before a later rollout,
regenerate from the exact artifact being deployed:

```sh
python3 scripts/rights_book.py edge public/rights-nobody-has-to-earn \
  --revision YOUR_FULL_BOOK_COMMIT \
  --edge-output docs/rights-book/cloudflare
```

The JSON documents describe separate zone ruleset phases. Merge the reviewed
rules into the zone's existing rulesets; do not replace unrelated rules with
these small proposals. Enable them only during an authorized rollout.

| Export | Intended behavior |
| --- | --- |
| `redirects.json` | Three exact-host, exact-path Single Redirects for GET/HEAD; 301; preserve queries and `/about/` → `#dossier` |
| `response-headers.json` | Prefix-scoped CSP, browser revalidation, nosniff, and successful-resource MIME types |
| `cache.json` | Cloudflare cache bypass for the unversioned book section |
| `artifact.json` | Integrated book/engine revisions and inventory counts; not an API payload |

Cloudflare supports static targets, 301, and query preservation in
[Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/).
The preview preserves raw encoded and repeated parameters before any target
fragment. The manifest's legacy URLs include trailing slashes. For example,
`/rights-nobody-has-to-earn/about/?x=1&x=2` redirects to
`/rights-nobody-has-to-earn/?x=1&x=2#dossier` locally, and to the absolute
`https://dhilipsiva.dev` equivalent at the edge.

The [header rules](https://developers.cloudflare.com/rules/transform/response-header-modification/reference/parameters/)
use `set`, not `add`. The CSP hashes every inline script in the assembled HTML, including
structured data, and allows same-origin scripts, styles, fonts, fetches and
module workers. `wasm-unsafe-eval` permits Wasm; Dioxus's document bridge also
needs `unsafe-eval`. Inline styles support the supplied SSR and UI styling.
The favicon uses a data URL. No inline-script wildcard is used.

Any global CSP must **exclude** this prefix. Multiple CSPs are enforced together;
the book policy cannot relax a second global policy. `static/_headers` now keeps
the existing non-book CSP as a scoped proposal rather than a wildcard header.
GitHub Pages does not apply `_headers`; none of these files updates the edge.

The MIME proposals cover Wasm, JavaScript, JSON, UTF-8 Markdown and gzip. They
only override successful responses, so a missing `.js` retains an HTML 404 type.
Serve `constitution.bin.gz` as `application/gzip` without falsely labelling
already-decoded bytes as gzip. The worker accepts both gzip resource bytes and
the bytes resulting from genuine HTTP decompression.

`Cache-Control: no-cache, max-age=0, must-revalidate` tells browsers to revalidate.
The separate [cache bypass rule](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
prevents stale unversioned book files at Cloudflare; a response-header transform
alone does not configure edge caching. Verify the zone's browser TTL and existing
cache rules do not override this behavior. Cloudflare can report `DYNAMIC` for
a bypassed resource.

During rollout, enable/verify negotiated Brotli/Gzip compression for book HTML,
CSS, JavaScript, JSON, Markdown and Wasm using the zone's
[compression settings](https://developers.cloudflare.com/rules/compression-rules/settings/).
Keep compressed-resource handling correct for the already gzipped constitution;
check `Content-Encoding`, decoded bytes and `Vary: Accept-Encoding` on the real
host. The local server serves raw gzip resources and does not emulate edge
compression negotiation. `python3 scripts/preview_site.py --gzip-encoding`
also supports a local transport check with real `Content-Encoding: gzip`.

## Production 404 limitation and later rollout

The preview returns genuine 404 statuses with the supplied book document for
missing book routes and assets. Other missing paths use the website's 404.
[GitHub Pages selects a site-wide `/404.html`](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site);
this static deployment cannot select the nested book error document. Production
therefore retains the website 404 and must still return status 404. Serving a
book-specific error body would require separately authorized edge or hosting
work. Do not replace missing routes with an HTTP 200 app shell.

After separate production authorization:

1. Recheck upstream `main`, record the chosen full commit and hosted CI status,
   and repeat local acceptance if the artifact changed. Review the latest edge
   exports, rule ordering, plan limits and the global CSP exclusion.
2. Coordinate the single Pages artifact and its matching headers. For later
   updates, temporarily allow the union of old/new inline-script hashes while
   switching the complete artifact, then narrow to the new hashes. Keep old
   artifact/header pairs available for rollback. Avoid separate partial uploads
   of HTML, Wasm, JS or input files. GitHub and Cloudflare are separate systems;
   these steps are not a cross-provider atomic transaction. Existing open tabs
   can still span an update because assets are unversioned.
3. Publish through the existing workflow and enable the reviewed edge rules.
   Verify proxying, the cache bypass, browser revalidation, MIME types and
   compression on GET and HEAD, including missing resources. Purge any older
   cached book files when activating the new cache policy.
4. Test all redirects with empty, encoded and repeated queries, the explicit
   dossier fragment, slashless directory navigation, deep refreshes and genuine
   404s. Fetch the public JSON, Markdown, sitemap, llms files and licenses.
5. With cache disabled, hover/focus the book anchors on unrelated website pages:
   zero book requests. Follow the complete reader: no engine requests. Confirm
   complete reading, metadata, fragments and footnote returns without JavaScript.
6. Open the game, confirm automatic worker startup, execute Nell, block an engine
   resource and retry. Check restored history, both themes, Tamil search,
   keyboard use and mobile layouts. Check the shared header/footer on the game,
   reader, search and error page, both theme buttons, preference persistence
   across website/book navigation, and the mobile menu without JavaScript.
   Confirm no CSP violations. Check real mobile
   hardware and Safari/Firefox separately; local Chromium is not that evidence.
7. Report the actual deployed commit, URL and results only after these production
   checks. Upstream CI repairs and framework migration remain separate work.

## Integrated source and current results

Integrated on 2026-09-23:

- Book: `dbfab823b64456a0211daf958ddb6424b18cbd1c` (`main` when fetched).
- Engine: `b707dad73876f7e1620ea8bb6f80242aa374c759`, taken from that commit's `engine.pin`.
- Matching private wasm-bindgen CLI: 0.2.128; local Rust: 1.97.1; Zola: 0.22.1.
- Fresh isolated book build and assembled website build passed: 121 files,
  37 routes, 34 reading inputs, plus the separate 404 document. The artifact
  override also passed. The raw mount remains unchanged. Assembled HTML now
  includes the shared site shell; removing its marked blocks recovers every
  original document exactly, and all other files remain byte identical.
- Ten hosting tests passed: query-preserving GET/HEAD redirects, method/path
  scope, directory slashes, 404s, MIME/cache/gzip headers, discovery, complete
  replacement, failure preservation, rejection of private/missing artifacts,
  shared template inclusion and detection of changes to upstream content.
- Before adding website chrome, the unchanged upstream acceptance suite passed against the assembled origin
  with the proposed CSP in Chromium 151.0.7922.34: 37 routes, all 34 reading
  inputs without JavaScript, all 78 live worker records, automatic startup,
  Nell's results, evidence removal, joint restoration, saved/shared history,
  resource failure/retry, cancellation, Tamil search, fragments, footnote
  returns and keyboard use. Both themes passed at 390, 768 and 1280px, with
  18 screenshots and six contrast/layout checks.
- Local automatic startup measured 1.002 seconds; record execution measured
  6.018–9.446 seconds. Theme interaction during execution measured 34.3–50.9 ms.
  These are local measurements, not internet download or mobile-device timings.
- After adding the shared header/footer, UI acceptance passed again with
  `--skip-reasoning`: all static reading routes, metadata, gameplay, Nell's
  execution, restored/shared history, resource failure/retry, storage failure,
  search, fragments, footnotes and keyboard checks. This run retained the live
  game checks and omitted the unchanged 78-record engine sweep above. Both
  themes passed the same 390/768/1280px layout and contrast checks. The only
  upstream test adaptation was the first skip-link selector described above.
- Shared chrome checks passed at 390 and 1280px in both themes: header/footer
  placement, current Books navigation, both theme buttons, saved progress,
  website/book theme persistence, mobile menu, keyboard skip link, and shared
  navigation without JavaScript. Eight header/footer screenshots are in the
  private host report directory. Zero CSP violations were recorded.
- Host checks passed on the fully local preview: home, book listing and detail
  anchors caused zero book requests on hover/focus; ordinary readers loaded no
  engine; mobile layout and discovery links passed; zero CSP violations were
  recorded. Both the raw gzip resource and genuine browser-decoded HTTP gzip
  initialized the engine and executed Nell. The first test approach timed out
  while injecting a 127 MB decoded body through Playwright; the final passing
  test uses an actual HTTP gzip response instead.

The working preview uses `public/` built with
`--base-url http://127.0.0.1:8790`. Its results remain private at the paths above.
Other external apps were not rebuilt for this book-focused preview; their
existing production build steps are retained.

The integrated commit's [hosted Book UI run](https://github.com/dhilipsiva/rights-nobody-has-to-earn/actions/runs/35852892324)
is **failed**, checked on 2026-09-23. Web compilation and source/compiled
comparison passed. Formatting failed because generated
`nibli/nibli-pipeline/src/bindings.rs` was absent; browser checks were skipped.
Linux passed. Windows failed with a `UnicodeDecodeError` while reading UTF-8 as
a Windows code page. These upstream repairs are outside this website change.
Local integration results do not assert a successful hosted run.
