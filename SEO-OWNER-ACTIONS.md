# SEO / GEO — Owner Actions (off-platform)

These steps **cannot be done in the repo** — they need dashboard/account access (DNS, Google/Bing,
Cloudflare, Medium/dev.to, GitHub) or an asset only you can provide. The in-repo code chunks are in
**[SEO-PLAN.md](SEO-PLAN.md)** (IDs `R1`–`R9`); `↔ Rx` below marks where a code change and an owner
action depend on each other.

All zero-spend. Cloudflare free-tier rule budget is generous (10 Single Redirects + 10 Transform Rules
per zone); this plan uses ~3 total.

---

> **✅ Done & removed:** **O1** — site verified in Google Search Console + Bing Webmaster. · **O3** —
> Cloudflare "Block AI bots" confirmed OFF (AI crawlers not blocked). · **R1** live: `/robots.txt` +
> `/llms.txt` deployed and confirmed serving.

## O2 — Cloudflare: HTTPS done; the rest is optional  ·  ↔ R8, R9
- [x] **Always Use HTTPS = ON** (SSL/TLS → Edge Certificates). ✅ Done — this is the SEO-relevant part.
- [x] **`www` → apex 301** — ✅ already working (verified `curl -sI https://www.dhilipsiva.dev/` →
      `301 → https://dhilipsiva.dev/`; apex → 200). No action needed.
- [ ] **Security headers (optional, NOT an SEO factor):** the CSP/security headers in `static/_headers`
      are inert on GitHub Pages. To make them live, create a **Transform Rule → Modify Response Header**,
      porting the CSP **verbatim** from `static/_headers`. Defer unless you want the hardening. `↔ R9`.
- [ ] **Where the rules live (dashboard nav):** "Managed Transforms / Bulk Redirects / URL Normalization"
      that you saw are *sub-items*. The Redirect-Rule and Transform-Rule **builders** are under
      **Rules → Overview → Create rule** (all free on every plan). Brotli + HTTP/3 are **on by default**
      now; Early Hints is under **Speed → Optimization** if wanted (`↔ R8`, minor).

## O4 — Cross-post canonicals → `.dev`  ·  ↔ R2/R3
Point each third-party original's canonical at the matching `.dev` page (consolidates authority/citations
on `.dev`; `.dev` stays self-canonical). 11 cross-posts total.

**dev.to (2) — easy, do now.** Edit post → set the **Canonical URL** field:
- [ ] `analyzing-python-compression-libraries…` → `https://dhilipsiva.dev/musings/python-compression/`
- [ ] `hi-im-dhilipsiva` → `https://dhilipsiva.dev/musings/hi-im-dhilipsiva/`

**Medium (8) — harder, optional/defer.** Medium has **no canonical field for natively-written stories**;
the only way to set canonical → `.dev` is to delete the story and **re-import from the `.dev` URL** (the
importer sets canonical to the source). Tedious + slightly destructive — defer unless you care about
out-ranking Medium for these. The `.dev` copies are already self-canonical, so nothing breaks if skipped.
Stories: black-holes-true-vacuum, clash-royale-legendary, architecture-at-appknox, the-feathered-bond,
gunicorn-workers, actix-websocket-protobuf, looking-for-a-new-role, solar-desalination → each maps to
`https://dhilipsiva.dev/musings/<same-slug>/`.

- [ ] **python-libraries — no action:** its "original" is a Wayback snapshot of the lost `.com`; nothing
      to set there. `.dev` stays self-canonical.

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

## O8 — Measurement loop  ·  GSC/Bing already verified (was O1)
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
- [ ] Enable it **now** — no CSP change needed yet, since no custom CSP is enforced at the edge (the
      `static/_headers` CSP is inert on GitHub Pages). The `R9` CSP allowlist only matters **if/when** you
      later ship the security headers via a Transform Rule (`O2`).

---

### Analytics & GDPR
Cloudflare Web Analytics is **cookieless** → **no GDPR/ePrivacy consent banner** and no privacy-policy
obligation beyond an optional transparency note. **Google Analytics 4 was rejected** because its cookies
would force a consent banner + privacy policy + US-transfer basis, breaking the site's no-cookie brand.
