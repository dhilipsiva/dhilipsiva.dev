# SEO / GEO — Owner Actions (off-platform)

These steps **cannot be done in the repo** — they need dashboard/account access (DNS, Google/Bing,
Cloudflare, Medium/dev.to, GitHub) or an asset only you can provide. The in-repo code chunks are in
**[SEO-PLAN.md](SEO-PLAN.md)** (IDs `R1`–`R9`); `↔ Rx` below marks where a code change and an owner
action depend on each other.

All zero-spend. Cloudflare free-tier rule budget is generous (10 Single Redirects + 10 Transform Rules
per zone); this plan uses ~3 total.

---

> **✅ Done:** **O1** GSC + Bing verified · **O3** Cloudflare "Block AI bots" OFF · **O5** reciprocal
> website/`rel="me"` links set (GitHub `rel="nofollow me"` → `dhilipsiva.dev` verified) · **O6** headshot
> at `static/assets/avatar.jpg` (800×800 square) — R3 wires `config.extra.avatar = "/assets/avatar.jpg"`.
> **R1** + **R2** live.

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

**dev.to (2) — DECIDED: skip.** The canonical is a per-post field (in the Markdown editor's front matter
as `canonical_url:`), not in profile settings. Only 2 low-traffic posts and the `.dev` copies are already
self-canonical, so it's not worth the friction. (If ever wanted: python-compression →
`/musings/python-compression/`, hi-im-dhilipsiva → `/musings/hi-im-dhilipsiva/`.)

**Medium (8) — harder, optional/defer.** Medium has **no canonical field for natively-written stories**;
the only way to set canonical → `.dev` is to delete the story and **re-import from the `.dev` URL** (the
importer sets canonical to the source). Tedious + slightly destructive — defer unless you care about
out-ranking Medium for these. The `.dev` copies are already self-canonical, so nothing breaks if skipped.
Stories: black-holes-true-vacuum, clash-royale-legendary, architecture-at-appknox, the-feathered-bond,
gunicorn-workers, actix-websocket-protobuf, looking-for-a-new-role, solar-desalination → each maps to
`https://dhilipsiva.dev/musings/<same-slug>/`.

- [ ] **python-libraries — no action:** its "original" is a Wayback snapshot of the lost `.com`; nothing
      to set there. `.dev` stays self-canonical.

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

## O9 — Web Analytics RUM beacon  ·  ⏭️ SKIPPED (owner decision)
- [x] **Server-side analytics** — already on (Cloudflare's default cookieless traffic stats for proxied
      domains: visitors, top paths, countries, **and bot/crawler hits** → covers the O8 measurement loop).
- [⏭️] **RUM beacon — SKIPPED.** Owner couldn't locate Cloudflare Web Analytics in the dashboard (it *is*
      free for all plans — likely a nav change, not a paywall — but not worth chasing). No client-side
      beacon. Consequence: **R9 dropped** (no beacon → nothing to allowlist in the CSP). Server-side
      analytics is enough for measurement. Revisit only if real-user page analytics / CWV are wanted later.

---

### Analytics & GDPR
**Server-side Cloudflare analytics only** (already on; cookieless, no beacon, no script on the page) →
**no GDPR/ePrivacy consent banner**, nothing to disclose. The RUM beacon (O9) was skipped → R9 dropped.
**Google Analytics 4 was rejected** because its cookies would force a consent banner + privacy policy +
US-transfer basis, breaking the site's no-cookie brand.
