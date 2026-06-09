# Handoff: dhilipsiva.dev — personal & portfolio website

## Overview
A fast, accessible, content-first **personal/portfolio website** for dhilipsiva — a software architect and open-source builder (Rust, Python, distributed systems, WebAssembly, symbolic reasoning). Multi-page, long-lived, content-first. This bundle contains a **vertical slice**: the shared chrome (header/footer), the Home/landing page, the Things-I-Built index, and the single-Musing reading template — plus a hero-direction exploration and a build hand-off doc.

The full site is 9 primary pages + 5 supporting templates. The remaining 11 are specified (with drop-in build prompts) in `handoff.html` → §07 and summarized under **Remaining templates** below.

## About the design files
The files in this bundle are **design references implemented in static HTML/CSS**. They are unusually close to production (no framework, one stylesheet, ~30 lines of JS) and **can be shipped as-is as a static site** — but the intent is that you **recreate/assemble them in the target environment** using its established patterns:
- If building with a **static-site generator** (recommended: Astro, Eleventy, Hugo, or Zola): lift `assets/quine.css` verbatim, turn the repeated header/footer into a layout/partial, and turn each page's content into templates fed by Markdown/MDX + the data shapes below.
- If building in **React/Vue/Svelte**: port the markup to components, keep `assets/quine.css` and its class names intact (they are the design system).

Either way: **do not restyle.** All visuals come from the QUINE Design System tokens already baked into `assets/quine.css`.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, components, and interactions. Recreate pixel-faithfully. Realistic placeholder copy is used throughout; every dynamic region is marked with an `<!-- SLOT: field -->` comment naming the fields to inject. The owner writes final copy later.

---

## Design system: QUINE
Dark-first, terminal-flavored, scientific. Mono-forward type, a single ember accent, phosphor "life" signal, blueprint-grid backgrounds, and mathematical Unicode glyphs as iconography. **No emoji.** Voice is dry, precise, quietly hopeful ("Nothing is owed. Build anyway.").

All tokens live in `assets/tokens/*.css` and are imported by `assets/quine.css`. **Use the CSS variables and component classes — never hardcode values.**

### Color tokens (exact hex)
| Token | Value | Use |
|---|---|---|
| `--void-1000` | `#07070A` | deepest (terminal bg, code blocks) |
| `--void-900` / `--bg-base` | `#0B0B10` | page background (the "void") |
| `--void-800` / `--bg-raised` | `#111119` | raised surface, mobile nav drawer |
| `--void-700` / `--surface-card` | `#181822` | cards |
| `--void-600` / `--surface-inset` | `#20202C` | insets, pills, inputs, hover |
| `--void-500` / `--border-subtle` | `#2A2A38` | hairline borders |
| `--void-400` / `--border-strong` | `#3A3A4A` | strong borders |
| `--paper-100` / `--text-strong` | `#F4F3EF` | primary text (warm off-white, never pure #FFF) |
| `--paper-200` / `--text-body` | `#C9C8C2` | body text |
| `--fg-muted` / `--text-muted` | `#908F9A` | secondary text |
| `--fg-faint` / `--text-faint` | `#5E5E6C` | tertiary / placeholder |
| `--ember-500` / `--accent` | `#F2542D` | **primary accent** — actions, focus, links, "active" marker |
| `--ember-300` / `--accent-hover` | `#FF9A6F` | hover, inline-code text |
| `--ember-600` | `#D8431B` | press |
| `--phosphor-500` / `--alive` | `#38E3A6` | active/live/success ("alive" signal) |
| `--phosphor-300` | `#8BF0CE` | phosphor text on dark |
| `--quanta-500` / `--symbol` | `#8B7CF6` | Wasm/Web3/symbolic accents (sparingly, flat) |
| `--amber-500` | `#F5B544` | warning / archived status |
| `--sky-500` | `#4DB8FF` | info; code function color |
| `--crimson-500` | `#FF4D5E` | danger |
| `--text-on-ember` | `#2A0A00` | text on ember fills |

A `[data-theme="light"]` scope ("daylight nihilism") inverts surfaces to paper-and-ink while ember keeps burning. Full overrides are in `assets/tokens/colors.css`. The theme attribute goes on `<html>`; persisted in `localStorage` key `dsiva-theme` by `assets/site.js`. An inline `<head>` script applies it pre-paint to avoid FOUC.

### Typography
- Families: `--font-mono` IBM Plex Mono (UI default, labels, data, code) · `--font-sans` IBM Plex Sans (body/long-form) · `--font-display` Space Grotesk (headlines, tracking ~ -0.035em) · `--font-serif` IBM Plex Serif **italic** (pull-quotes/taglines).
- Scale (1.25 major third, 16px root): `--text-2xs` 11 · `--text-xs` 12 · `--text-sm` 14 · `--text-base` 16 · `--text-md` 18 · `--text-lg` 22 · `--text-xl` 28 · `--text-2xl` 36 · `--text-3xl` 48 · `--text-4xl` 64 · `--text-5xl` 88.
- Weights 300–700; line-heights `--leading-tight` 1.05 → `--leading-relaxed` 1.7; tracking `--tracking-caps` 0.12em for the signature wide-tracked mono uppercase labels.
- Loaded from Google Fonts CDN (`assets/tokens/fonts.css`). **For production, self-host the four OFL families** and replace the `@import` with local `@font-face`.

### Spacing, radii, effects (4px grid)
- Spacing: `--space-1` 4px → `--space-10` 128px (4/8/12/16/24/32/48/64/96/128). Container caps: `--site-max` 1120px, `--read-max` 720px. Control heights 28/36/44px.
- Radii (tight, engineered): `--radius-xs` 2 · `--radius-sm` 4 · `--radius-md` 6 · `--radius-lg` 10 · `--radius-xl` 16.
- Borders: hairline 1px (`--border-subtle`), bold 2px (`--border-strong`). "Active/featured" = 2px ember **top-rule** on a card (`.q-card--marked`), not a fill.
- Signature elevation is a **colored glow**, not a drop shadow: `--glow-ember`, `--glow-phosphor` (used on hovered primary buttons / live nodes).
- `--bg-grid` is the 24px blueprint hairline lattice, radial-masked behind heroes/CTAs.
- Focus ring `--ring` = 2px offset ember ring. **Never remove outlines.**
- Motion: durations 80/140/220/360ms; `--ease-out` default; one `--ease-spring` for confirmations. All collapses under `prefers-reduced-motion` (handled in tokens).

---

## Screens / views

### 1. Home (`index.html`)
**Purpose:** present who he is + the verbatim tagline fast, then route to projects/musings/contact.
**Layout:** sticky glass header → hero → featured projects → featured book → latest musings → Now strip → social row → footer. All sections in a `.container` (max 1120px, 28px gutters).
- **Hero** (`.hero`, 2-col `1.05fr 0.95fr`, gap 52px; collapses to 1-col ≤900px): left = `.hero__eyebrow` (alive badge + location), `h1` 56px Space Grotesk with ember `<em>`, `.hero__tagline` (serif italic, 2px ember left-border — **verbatim tagline, do not edit**), `.hero__intro`, `.hero__actions` (primary + secondary + ghost buttons). Right = a **terminal window** (`.term`) showing `whoami --verbose` identity output with a blinking `.q-cursor`. Blueprint grid radial-masked behind (`.hero__grid`).
- **Featured projects** (`.proj-grid.proj-grid--3`): 3 `.proj-card` in `.q-card--marked` (ember top-rule). Each: glyph + status badge, title, description, role/meta, tech pills, links row.
- **Featured book** (`.feat-book` in `.q-card--grid`): 168×240 cover + status badge + title + blurb + CTAs.
- **Latest musings** (`.post-list` of `.teaser`): title + date row + excerpt, links to single-musing.
- **Now strip** (`.now-strip` in `.q-card`): inline `key → value` items + "see all" link.
- **Social row** (`.social-row`): GitHub, LinkedIn, Stack Overflow, Medium, Email (`mailto:dhilipsiva@pm.me`), RSS — 34px bordered squares, hover → ember.

### 2. Things I Built (`things-i-built.html`)
**Purpose:** showcase projects, segmented by where they live.
**Layout:** page head (eyebrow + 46px `h1` + lead intro + mono count summary) → **Personal / Open-source** section → `<hr.divider>` → **Professional** section → a serif-quote CTA card.
- Each section: `.sec-head` (eyebrow + title + intro) then `.proj-grid` (2-up, → 1-up ≤760px) of `.proj-card`. Personal cards use `.q-card--marked`; professional use plain `.q-card`.
- **Project card anatomy:** `.proj-card__top` (mono glyph + status `.q-badge`), `.proj-card__title`, `.proj-card__desc`, `.proj-card__meta` (role · visibility), `.proj-card__tags` (`.pill`s), `.proj-card__links` (Lucide-style inline SVG icons + label, top-bordered). Status badges: `--alive` active, `--neutral` shipped, `--warning` archived, `--symbol` version.

### 3. Single Musing (`single-musing.html`) — the key reading layout
**Purpose:** the most important long-form reading template. Reused by Single Book reviews.
**Layout:** narrow `.container--read` (720px) → breadcrumb → `.article-head` (meta row: date · reading time · type; 46px `h1`; tag pills) → optional hero `figure`/`.img-slot` → `.prose` body → `.footnotes` → `.article-foot` (tags + Discuss/All-musings buttons + `.prev-next` grid).
- **`.prose` supports:** `h2`(28)/`h3`(21)/`h4`(mono uppercase) headings; paragraphs (18px sans, 1.7 line-height); `ul`/`ol` with ember markers; `blockquote` (serif italic, ember left-rule, optional `<cite>`); fenced `pre code` blocks (void-1000 bg, `.c-key/.c-fn/.c-str/.c-num/.c-com/.c-type/.c-pun` syntax spans); inline `code` (ember on inset); `figure` + `figcaption`; footnote refs (`.fn-ref`) ↔ `.footnotes` list.
- **Multilingual:** Tamil/mixed-script paragraphs use `lang="ta"` (or `.tamil`) → extra line-height (1.95). The type scale handles tall vowel signs.

### Hero exploration (`hero-explorations.html`) — review artifact, not a page
Three hero directions on a neutral canvas for the owner to choose: **A** terminal-forward (currently live in `index.html`), **B** quiet & literary (big display type, serif tagline pull-quote), **C** consensus node-graph (an SVG 5-node fixed-point diagram). Implement whichever the owner picks; A is the default.

### Build hand-off doc (`handoff.html`)
A styled in-browser doc: stack/approach, DS usage, full page/template status table, component inventory, content-slot/data-shape map, responsive + a11y notes, and **drop-in build prompts** for the 11 remaining templates. Open it first.

---

## Components (shared inventory)
| Component | Class / markup | States & variants |
|---|---|---|
| Header / nav | `.site-header` + `.nav` | sticky glass; `aria-current="page"`; mobile = pure-CSS checkbox `#nav-switch` drawer (≤860px) |
| Footer | `.site-footer` | brand+tagline, Site/More link columns, social row, RSS, copyright, "built with care" |
| Social-icon row | `.social-row` | GitHub/LinkedIn/Stack Overflow/Medium/Email/RSS; hover→ember |
| Button / CTA | `.q-btn` + `--primary`/`--secondary`/`--ghost`/`--danger`, sizes `--sm`/`--lg`/`--block` | hover ember glow (primary), 1px press nudge; one primary per view |
| Card | `.q-card` + `--pad`/`--inset`/`--grid`/`--interactive`/`--glow`/`--marked` | `--marked` = ember top-rule (active/featured) |
| Badge | `.q-badge` + `--alive`/`--ember`/`--neutral`/`--warning`/`--symbol`/`--solid`, optional `.q-badge__dot` | status/version chips |
| Callout | `.q-callout` + `--note`/`--ok`/`--warn`/`--error`/`--theorem` | `--theorem` (∴, violet) for claims; use `--ok` for form success |
| Tag / pill | `.pill` + `.pill--active` | filters, tech tags, post tags |
| Field / input | `.q-field` / `.q-input` (+ `--lead`, `--error`; `textarea.q-input`) | label, hint, error; focus = ember + soft ring |
| Tabs | `.q-tabs` / `.q-tab` | animated underline; `aria-selected` |
| Section header | `.sec-head` | eyebrow + title + intro + "see all" |
| Project card | `.proj-card` in `.q-card` | glyph, status, tech pills, role, links; featured = 3-up |
| Book card | `.feat-book` / `.book-card` | authored (status badge) vs reviewed (author + rating ★) |
| Post-list item | `.post-item` / `.teaser` | date, tags, excerpt, reading time; `--pinned` featured |
| Breadcrumb | `.breadcrumb` | single & archive pages |
| Prev / next | `.prev-next` / `.pn-card` (`--prev`/`--next`) | post footer nav |
| Prose | `.prose` | headings, lists, quote, code, figure, footnotes, `:lang(ta)` |
| Image / cover slot | `.img-slot` | dashed blueprint placeholder + label → swap for real `<img>` |
| Eyebrow / comment | `.eyebrow` / `.comment` | the `//` mono prefix, lowercase |
| Terminal | `.term` / `.term__bar`/`__body` + `.c-*` spans | code/identity display |

### To design (specified in `handoff.html` §07)
Contact form states (default/error/success), pagination.

---

## Interactions & behavior
- **Mobile nav:** pure-CSS — a hidden checkbox `#nav-switch` toggled by a `<label>` hamburger; `:checked ~ .site-header__inner .nav` reveals a full-width drawer at ≤860px. **Works with JS disabled.** `site.js` only adds "close drawer on link click."
- **Theme toggle:** `.theme-toggle` button flips `data-theme` on `<html>` and writes `localStorage['dsiva-theme']`. Inline `<head>` script applies saved theme before paint.
- **Hover:** primary buttons gain `--glow-ember`; cards shift border to ember (`--interactive`) or glow (`--glow`); pills/links → ember. **Press:** 1px `translateY`.
- **Focus:** 2px offset ember ring everywhere (`--ring`).
- **Motion:** blinking cursor (`.q-cursor`), tab underline scaleX, button transitions — all collapse under `prefers-reduced-motion`.
- No client-side routing; real `<a href>` page-to-page navigation. No data fetching in the mocks.

## Responsive behavior
- Nav → drawer at **≤860px**.
- Hero 2-col → 1-col at **≤900px** (h1 56→42px).
- Project grid 3-up/2-up → **1-up at ≤760px**.
- Footer 3-col → **2-col at ≤720px** (brand full-width); Now strip & social row stack at ≤720px.
- Reading column capped at **720px**; post meta stacks, article h1 46→34px, prev/next → 1-col at **≤640px**.
- Code blocks scroll-x rather than breaking layout.

## Accessibility (WCAG AA)
- Skip-link, semantic landmarks (`header`/`main`/`nav`/`footer`), `aria-current`, `aria-label`s on icon-only controls and social links.
- Every `.img-slot` has `role="img"` + label — **replace with real `alt` text (required slot).**
- Mixed-script content uses `lang` attributes.
- Visible ember focus ring preserved; color pairings meet AA on the void.

---

## Content slots / data shapes
Every dynamic region is marked `<!-- SLOT: fields -->` in the HTML. Entities:
- **Project**: `title, slug, description, longDescription?, tech[], role, status(active|shipped|archived), links{repo,live,writeup}, category(personal|professional), featured, glyph, image?`
- **Book**: `title, slug, kind(authored|reviewed), cover, status(in-progress|published|upcoming) | author, blurb, rating?, link, featured`
- **Post (Musing)**: `title, slug, date, tags[], excerpt, readingTime, body, heroImage?, pinned`
- **Talk**: `title, event, date, links{slides,video,page}, description?`
- **Uses entry**: `category, name, link?, note?`
- **Now**: `lastUpdated, sections[]{label, items}`

Per-page SEO slots in each `<head>`: `<title>`, meta description, OG/social image placeholder. Musings index needs an `application/rss+xml` `<link>` (stubbed on Home).

## Remaining templates (build next; prompts in `handoff.html` §07)
Books · Musings index (pagination + pinned + RSS) · Tag archive · About (bio + philosophy + timeline + skills) · Now · Uses · Talks · Contact (form + states) · Single Project (case study) · Single Book (review reuses `.prose`) · 404 (voice-led: "⊥ halt. this path has no fixed point.").

## Assets
- `assets/mark.svg` — logomark (two ember chevrons converging on a phosphor fixed point). `mark-mono.svg` (currentColor), `lockup.svg` (mark + wordmark + tagline).
- `assets/covers/fixed-point-of-thought.svg` — on-brand **typographic placeholder** book cover (void + grid + ember, `f(x)=x` motif). Generate more in the same style or swap for real covers.
- Icons: math/logic Unicode glyphs (`∴ ∀ λ ⊢ ⇄ ∇ ≡ ⊗ ⎇`) in mono for meaning; **Lucide** line-icons (inlined as SVG here) for UI affordances — `https://unpkg.com/lucide@0.456.0`. **No emoji.**
- No photography. Where imagery exists it should be data (node graphs, terminal output), cool/desaturated.

## Files in this bundle
| File | What it is |
|---|---|
| `index.html` | Home / landing (terminal-forward hero) |
| `things-i-built.html` | Projects — segmented personal / professional grid |
| `single-musing.html` | Long-form reading template (key reading layout) |
| `hero-explorations.html` | 3 hero directions for review — not a site page |
| `handoff.html` | In-browser build hand-off (inventory, slots, prompts) |
| `assets/quine.css` | QUINE tokens (@imports `tokens/*`) + component classes + site composition |
| `assets/site.js` | Theme-toggle persistence (progressive enhancement) |
| `assets/tokens/*.css` | DS tokens: fonts, colors, typography, spacing, effects, motion, base |
| `assets/mark.svg`, `mark-mono.svg`, `lockup.svg` | Logo |
| `assets/covers/*.svg` | Placeholder book covers |

## Start here
1. Open `handoff.html` in a browser for the visual inventory + per-template build prompts.
2. Lift `assets/quine.css` + `assets/tokens/` unchanged.
3. Extract the header/footer into a layout/partial; wire content via the data shapes above.
4. Build the 3 included pages first, then the remaining 11 from §07 prompts.
