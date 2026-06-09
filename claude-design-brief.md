# Design Brief — Personal & Portfolio Website for dhilipsiva

> **For: Claude Design.** This is a design brief for a multi-page personal/portfolio website.
> Your job is to design **all layouts, pages, and reusable components** described below, and hand back the
> designs + hand-off files/prompts. The site will be hand-built afterward, so structure, clear content slots,
> and reusable components matter as much as the visuals.
>
> **Two things up front:**
> 1. **Use the Design System already loaded in this project.** Apply its colors, typography, spacing, and
>    components throughout. This brief deliberately specifies **no** colors, fonts, or visual styling — those
>    come from the loaded Design System. Don't invent a new visual language.
> 2. **This brief is structure and content-architecture, not final copy.** The site owner will write the real
>    content later. Lay out every page with clearly-labeled **placeholder content** and obvious **content slots**
>    so copy can be dropped in cleanly.

---

## 1. Project overview

A fast, accessible, content-first personal and portfolio website for a software architect and open-source builder.
It's multi-page, intended to last for years, and is the owner's primary home on the web — replacing an older blog.
The tone is technical and intellectual but human. Prioritize legibility, clean information hierarchy, and a design
that ages well over trend-chasing. Assume the content can be long-lived and occasionally long-form (essays, code,
multilingual text).

**Goals**
- Present who the owner is and what he believes, quickly, on the landing page.
- Showcase the things he has built (personal and professional).
- Feature his books — both ones he's writing and ones he reviews.
- Host a long-running blog ("Musings").
- Provide the usual personal-site utility pages (About, Now, Uses, Talks, Contact).

---

## 2. About the person & voice

**Identity (use this tagline verbatim somewhere prominent, e.g. the hero):**

> An Optimistic Nihilist who loves Science, Rust, Python, FOSS, WebAssembly, WebRTC, Web3, Distributed Systems,
> and symbolic reasoning.

- **Who he is:** A software architect and lifelong builder. Currently a Software Architect; previously VP of
  Engineering. Based in Bangalore, India. He identifies as a builder, not an entrepreneur — he wants to *build
  things*, not run a business.
- **Domains:** Rust, Python, distributed systems, WebAssembly, symbolic reasoning / formal logic, FOSS, AI
  reasoning systems, cloud/infra.
- **Voice & tone:** Philosophical, direct, intellectually curious, a little irreverent, freedom- and
  FOSS-oriented. Comfortable with deep ideas (formal logic, philosophy of mind, Gödel-Escher-Bach-style
  self-reference). Multilingual — writes in English and Tamil. Placeholder copy and microcopy should reflect this:
  smart, plain-spoken, unpretentious, occasionally playful. Avoid corporate marketing-speak.

Let the personality come through in **structure and microcopy** (section labels, empty states, button text,
404 copy), not in decoration.

---

## 3. Design system (important)

- **Apply the Design System already loaded in this Claude Design project.** Use its tokens and components for all
  color, typography, spacing, elevation, and interactive states.
- This brief intentionally **omits** any visual styling direction. Do not introduce new palettes or fonts.
- Only constraints on your styling choices:
  - Honor the persona — technical, intellectual, FOSS-builder. Substance over flash.
  - Meet **WCAG AA** contrast and accessibility.
  - Keep it content-first and uncluttered; reading comfort is paramount for long-form pages.
- Light/dark handling, accent usage, and component look should all defer to the loaded Design System.

---

## 4. Sitemap & global navigation

**Primary pages**
1. **Home** (landing)
2. **Things I Built** (projects — personal + professional)
3. **Books**
4. **Musings** (blog)
5. **About**
6. **Now**
7. **Uses**
8. **Talks**
9. **Contact**

**Supporting layouts** (design these as reusable templates, not one-off pages)
- **Single Musing** (individual blog post)
- **Tag / topic archive** (list of posts filtered by a tag)
- **Single Project** (optional detail/case-study page for a built thing)
- **Single Book** (optional detail page / full review)
- **404 / not-found**

**Global navigation**
- **Header**: site identity ("dhilipsiva") + primary nav. The full set is nine pages — design the nav so it stays
  clean: keep the core links (Home, Things I Built, Books, Musings, About, Contact) primary, and group the utility
  pages (Now, Uses, Talks) sensibly (e.g. a secondary group, an "more" overflow, or surfaced in the footer) — your
  call based on the loaded Design System. Provide a mobile nav pattern.
- **Footer**: social links (GitHub, LinkedIn, Stack Overflow, Medium, email), an RSS link for Musings, a copyright
  line, and quick links to the utility pages. Optionally a short "built with care / open source" line.
- **Social set** (used in header/footer/contact): GitHub, LinkedIn, Stack Overflow, Medium, Email.

---

## 5. Page-by-page blueprints

Each page lists the **sections** and the **content slots** to lay out with placeholders. No final copy required.

### 5.1 Home / Landing
- **Hero**: name/identity, the verbatim tagline (section 2), a 1–2 sentence intro slot, and primary CTAs
  (e.g. "Things I Built", "Read the Musings", "Get in touch").
- **Featured projects strip**: 2–3 highlighted project cards (e.g. a flagship Rust/WASM reasoning engine and a
  reasoning kernel). Reuses the **project card** component.
- **Featured book**: a single highlighted book (cover, title, status, one-line blurb, CTA to Books).
- **Latest Musings**: 3 most-recent post teasers (reuses **post-list item**), with a "See all" link.
- **Currently / Now teaser**: a compact strip summarizing what he's focused on now, linking to the Now page.
- **Social row**: the social set.

### 5.2 Things I Built
- **Intro line**: one-sentence framing slot.
- **Segmentation**: two clearly separated groups — **Personal / Open-source** and **Professional** — since he has
  architected and built both. (A filter/toggle is also acceptable if it fits the Design System.)
- **Project grid**: cards using the **project card** component. Each card:
  - Title, one-line description, **tech-tag pills** (e.g. Rust, WASM, Python, Distributed Systems),
    role/contribution label (e.g. "Architected & built"), status (e.g. Active / Shipped / Archived),
    and links (source repo / live / write-up).
- **Optional single-project layout**: for deeper case studies — title, summary, role, tech, problem→approach→outcome
  sections, links, and an image/diagram slot.

### 5.3 Books
Two distinct sections:
- **Writing / Authored**: books he is writing or has published. Each entry: cover image slot, title, **status**
  (In progress / Published / Upcoming), a blurb, and a link/CTA. (Examples to expect: a book on symbolic reasoning,
  and others — design for 1–4 entries, possibly more over time.)
- **Reviews & Reading**: books he has reviewed or recommends. Each entry: cover, title, author, an optional
  rating/marker, short note, and a "Read review" link.
- Use a **book card** component for both, with a variant for authored vs. reviewed.
- **Optional single-book layout**: full review / book page — cover, metadata, long-form review body
  (reuses the long-form prose styles from the single-Musing layout).

### 5.4 Musings (blog)
- **Index**: list of posts using the **post-list item** component — title, date, tag pills, short excerpt,
  reading time. Support **pagination**. Allow an optional **pinned/featured** post treatment at the top.
- **Tag / topic archive**: same list, scoped to one tag, with the tag name as a heading and a post count.
- **Single Musing (post) layout** — this is the most important reading layout. Must comfortably support:
  - Title, date, tags, reading time, and an optional hero image.
  - Long-form prose: headings (H2–H4), paragraphs, lists, blockquotes, footnotes.
  - **Code blocks** with room for syntax highlighting + inline code.
  - **Images/figures** with captions.
  - **Non-Latin scripts** (Tamil) and mixed-script paragraphs — ensure the type scale and line-height handle this.
  - Post footer: tags, prev/next links, and a subtle "discuss/share" or back-to-index affordance.
  - An **RSS** affordance somewhere on the index.

### 5.5 About
- **Bio**: long-form introduction with a portrait/photo slot.
- **Philosophy**: a section for the "Optimistic Nihilist" worldview and what drives his work.
- **Experience timeline**: roles/companies over time (a vertical timeline or clean list) — title, org, dates,
  one-line description per entry.
- **Skills / domains**: grouped tags or a compact list (languages, systems, infra, etc.).
- **Interests & languages spoken**: short sections.
- **CTA** to Contact (and optionally a résumé/CV link slot).

### 5.6 Now
- A single-column, dated page in the spirit of the `/now` page convention.
- **Prominent "last updated" date** near the top.
- Grouped slots for: what he's building now, what he's writing/reading, current role/focus, and anything else
  on his mind. Keep it simple and personal.

### 5.7 Uses
- A categorized list of tools and setup. Suggested categories (each a labeled group with item + short note slots):
  - **Hardware** (machines, peripherals)
  - **OS & Environment** (e.g. NixOS / dotfiles)
  - **Editor & Terminal**
  - **Languages & Tools**
  - **Services & Apps**
- Use a clean, scannable **uses-list** component (item name + optional link + one-line note).

### 5.8 Talks
- A list of talks, meetups, and speaking. Use a **talk item** component. Each entry:
  - Title, event/venue, date, and links (slides / video / recording / event page).
- Optional **speaking availability** note + CTA to Contact at the top or bottom.
- Empty-state friendly (graceful if there are only a few entries).

### 5.9 Contact
- **Primary contact**: email (`dhilipsiva@pm.me`) shown prominently.
- **Social row**: the full social set.
- **Location**: Bangalore, India + an availability/“what to reach out about” note slot.
- **Contact form layout**: design a simple name / email / message form. (Implementation note for the build team:
  this will be wired to a mailto or a form service later — but please design the form regardless, including its
  success and error states.)

### 5.10 404 / not-found
- A friendly, on-brand not-found page with a short message slot and links back to Home / Musings / Things I Built.
- This is a good place for a touch of the owner's voice.

---

## 6. Reusable component inventory

Design these as a **shared component set** (with states + responsive behavior) so the same pieces are reused across
pages:

- **Header / nav** (desktop + mobile, with the secondary/utility grouping from §4)
- **Footer** (social, RSS, utility links, copyright)
- **Social-icon row** (GitHub, LinkedIn, Stack Overflow, Medium, Email)
- **Tag / pill** (default + active/selected states)
- **Project card** (with tech-tag pills, status, links; featured variant for Home)
- **Book card** (authored variant + reviewed variant)
- **Post-list item** (title, date, tags, excerpt, reading time)
- **Talk item**
- **Uses-list item**
- **Section header** (title + optional intro + optional "see all" link)
- **CTA / button** (primary + secondary)
- **Pagination**
- **Breadcrumb** (for single/archive pages)
- **Contact form** (fields + submit + success/error states)

---

## 7. Content types / data shapes

So that layouts expose consistent, clearly-labeled slots, here are the repeating entities and their fields:

- **Project**: title, slug, one-line description, longer description (optional), tech tags[], role/contribution,
  status, links { repo, live, writeup }, category (personal | professional), featured (bool), image (optional).
- **Book**: title, slug, kind (authored | reviewed), cover image, status (in-progress | published | upcoming) OR
  author (for reviewed), blurb/note, rating (optional, for reviewed), link, featured (bool).
- **Post (Musing)**: title, slug, date, tags[], excerpt, reading time, body (long-form), hero image (optional),
  pinned (bool).
- **Talk**: title, event, date, links { slides, video, page }, description (optional).
- **Uses entry**: category, name, link (optional), note (optional).
- **Now**: last-updated date + a set of free-form grouped sections.

---

## 8. Cross-cutting requirements

- **Responsive**: mobile-first; design for small / medium / large breakpoints. Nav, grids, cards, and the reading
  layout must all adapt gracefully.
- **Accessibility**: semantic structure, full keyboard navigation, visible focus states, alt-text slots on all
  images, and **WCAG AA** contrast (via the loaded Design System).
- **Performance / build-friendliness**: content-first; avoid layouts that *require* heavy client-side JavaScript.
  Interactivity (nav toggle, tag filter) should degrade gracefully. Optimize for fast first paint and long-form
  reading.
- **SEO & sharing**: include slots/placeholders for page title, meta description, and Open Graph / social-share
  image per page (especially Musings and Books).
- **Feeds**: an RSS affordance for Musings.
- **Theming**: light/dark and all visual treatment defer to the loaded Design System.

---

## 9. What to hand back

Please deliver:
1. A **layout for every page type** in §4–§5 (the 9 primary pages **plus** single-Musing, tag archive,
   single-project, single-book, and 404).
2. The **shared component inventory** from §6, with states and responsive variants.
3. **Responsive behavior notes** for the key layouts (nav, project/book grids, the reading layout).
4. **Clearly-marked content slots and placeholders** throughout, so real content can be injected later without
   guesswork — label each slot by the field names in §7 where it helps.
5. The accompanying **hand-off files and prompts** so the site can be built faithfully from your designs.

Structure the output so that **list/index pages, single-item pages, and tag-archive pages** are clearly
distinguished — these reusable templates are what the build will be assembled from.

---

*Thanks! Lean on the loaded Design System for everything visual; lean on this brief for everything structural.*
