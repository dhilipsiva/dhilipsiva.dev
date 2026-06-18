# SEO / GEO — Owner Actions (off-platform)

These steps **cannot be done in the repo** — they need dashboard/account access (DNS, Google/Bing,
Cloudflare, Medium/dev.to, GitHub) or an asset only you can provide. The in-repo code chunks are in
**[SEO-PLAN.md](SEO-PLAN.md)** (IDs `R1`–`R9`); `↔ Rx` below marks where a code change and an owner
action depend on each other.

All zero-spend. Cloudflare free-tier rule budget is generous (10 Single Redirects + 10 Transform Rules
per zone); this plan uses ~3 total.

---

## O1 — Verify the domain in Google Search Console + Bing  ·  do first
- [ ] In Cloudflare DNS, add the GSC **Domain-property TXT record** — keep it **DNS-only (gray cloud),
      never proxied**. (Whole-zone proof; survives static rebuilds, unlike an HTML-file/meta verification.)
- [ ] In GSC: verify, then **submit `https://dhilipsiva.dev/sitemap.xml`**; request indexing of the home + `/about/`.
- [ ] In Bing Webmaster Tools: **Import** the verified GSC property (one-click; pulls the sitemap).
- [ ] *Gates the measurement loop (`O8`). No code dependency.*

## O2 — Cloudflare rules (~3, inside free quota)  ·  ↔ R8, R9
- [ ] **Always Use HTTPS** = ON (SSL/TLS → Edge Certificates). *(toggle, 0 rule slots)*
- [ ] **`www` → apex 301** — Rules → Redirect Rules → **Single Redirect**. Filter
      `(http.host eq "www.dhilipsiva.dev")`; dynamic target `concat("https://dhilipsiva.dev", http.request.uri.path)`,
      status **301**, preserve query string. **Do NOT use Bulk Redirects** (free quota buggy at ~20).
- [ ] **Security headers** — Rules → Transform Rules → **Modify Response Header**. Port the CSP and other
      headers **verbatim from `static/_headers`** (GitHub Pages ignores that file). **Use the R9-updated
      CSP** (includes the Cloudflare Insights domains) — `↔ R9`, so do R9 first. Do **not** re-derive the
      CSP — dropping a Hugging Face entry breaks the `/chat` model download.
- [ ] **Performance toggles** (Speed/Network): enable **Brotli**, **HTTP/3 (QUIC)**, **Early Hints**.
      *(0 rule slots; `↔ R8`)*
- [ ] **Verify:** `curl -I https://dhilipsiva.dev` shows the headers; open `/chat` → console has no CSP
      violations and the HF model file + analytics beacon both load.

## O3 — Confirm Cloudflare "Block AI bots" toggle is OFF  ·  ↔ R1
- [ ] Cloudflare dashboard → check the managed **"Block AI bots" / AI-Audit** toggle is **OFF**. It can
      silently override the committed `static/robots.txt` and 403 the fetchers `R1` allows — the #1 cause
      of "open robots.txt but no citations."

## O4 — Cross-post canonicals → `.dev`  ·  ↔ R2/R3
- [ ] **dev.to:** add `canonical_url: https://dhilipsiva.dev/musings/<slug>/` to each cross-posted
      article's front matter.
- [ ] **Medium:** for each cross-posted story, set the canonical via Story settings (or re-import using
      Medium's import-from-URL so it auto-sets canonical → `.dev`).
- [ ] Consolidates authority on `.dev` so AI engines cite `.dev`, not the third party. `.dev` stays
      self-canonical (owner controls both copies).

## O5 — GitHub alignment + per-platform reciprocal links  ·  ↔ R4
Set the **exact string `https://dhilipsiva.dev/`** everywhere (makes `sameAs`/`rel=me` bidirectional —
the strongest free corroboration, since there's no Wikipedia/Wikidata entity):
- [ ] **GitHub** — profile **Website** field; profile **README** (`github.com/dhilipsiva`); the
      `dhilipsiva.dev` repo **About → Website** field. *(GitHub emits a verified reciprocal `rel="me"`.)*
- [ ] **dev.to** — Settings → Profile → "Websites".
- [ ] **StackOverflow** — Profile → "Website".
- [ ] **LinkedIn** — Contact info → Website. **Medium** — Settings → bio/website. **Twitter/X** — Profile → URL.

## O6 — Provide an author headshot  ·  ↔ R3, R4
- [ ] Add a real headshot to the repo (e.g. `static/img/avatar.jpg`, ~400×400). Once it exists, the
      `config.extra.avatar` value gets wired in `R3` (Person `image`) and `R4` (h-card `u-photo`).
      Materially aids person-entity disambiguation from the squatted `.com`.

## O7 — Wikidata: SKIP  ·  decision recorded
- [ ] **Do not create a self-authored Wikidata item** — likely fails notability and raises a
      conflict-of-interest concern. Revisit only if independent press / conference coverage accumulates.

## O8 — Measurement loop  ·  depends on O1
- [ ] **Brand-SERP benchmark:** in GSC Performance, watch the bare query **"dhilipsiva"** — success =
      `.dev` ranks above the squatted `.com`. If after ~8–12 weeks the `.com` still wins, deepen the
      GitHub README (`O5`) and earn an organic conference/talk link (still zero-spend).
- [ ] **AI-citation spot-checks:** periodically ask ChatGPT / Perplexity / Claude "Who is dhilipsiva?" /
      "dhilipsiva WebAssembly" and check whether `dhilipsiva.dev` is cited.
- [ ] **Crawl confirmation:** in Cloudflare free logs/analytics, confirm OAI-SearchBot / PerplexityBot /
      ClaudeBot fetches.

## O9 — Enable Cloudflare Web Analytics  ·  ↔ R9, O2
- [ ] Cloudflare → **Analytics & Logs → Web Analytics** → add `dhilipsiva.dev`. Because the domain is
      proxied, CF **auto-injects the beacon** (no script committed). **Free, cookieless, no consent banner.**
- [ ] `↔ R9` — the CSP must allowlist `static.cloudflareinsights.com` + `cloudflareinsights.com` or the
      beacon is blocked. `↔ O2` — port the R9-updated CSP.

---

### Analytics & GDPR
Cloudflare Web Analytics is **cookieless** → **no GDPR/ePrivacy consent banner** and no privacy-policy
obligation beyond an optional transparency note. **Google Analytics 4 was rejected** because its cookies
would force a consent banner + privacy policy + US-transfer basis, breaking the site's no-cookie brand.
