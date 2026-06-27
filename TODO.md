# TODO

## From the site review (2026-06-12, rated 8/10 — concept 10, content depth 6.5, first-visit clarity 6)
The hard parts are done; what's left is making them visible and finishing the copy.
- [ ] Content depth items below (book title, STGI) are the other half of the score gap.

## /nibli live demo
- The engine wasm is built from the nibli repo (WSL): `wasm-pack build nibli-wasm --release --target web`,
  then copy `nibli-wasm/pkg/nibli_wasm{.js,_bg.wasm,.d.ts}` → `static/nibli/wasm/`. The `nibli-wasm`
  crate is committed in the nibli repo (NOT pushed yet — push when ready).
- KNOWN ENGINE ISSUE (upstream, in logji): the Ch20 breach-notification query
  (`la .akmes. cu se bilga lo nu notci`) against the FULL gdpr.lojban corpus does not return in
  bounded time even in release (>240s, traced path) — matches the code-review-panel suspicion.
  Excluded from the demo; fix belongs in the nibli repo.

## /nibli page — needs updates
- [ ] **Transparency Triad: move descriptions out of the Source pane.** Pane 1 ("Source")
      currently streams every `#` comment from the `.lojban` KB files, but those comments mix
      section headers and English descriptions with the raw source text. Separate them so the
      Source pane shows raw source, with descriptions surfaced elsewhere (own field / sidebar /
      tooltip). Touchpoints: `static/nibli/app/nibli-worker.js` (loader tags lines `isComment`),
      `static/nibli/app/nibli.js` (`renderTriad`), `templates/nibli.html` (pane markup),
      `static/nibli/kb/*.lojban`.
- [ ] **Update nibli to latest.** Massive changes were made to nibli that aren't reflected here
      yet; refresh the nibli page(s) — `content/nibli.md` / `templates/nibli.html` and
      `content/things-i-built/nibli.md` — once the new details are supplied. (Owner to provide.)

## Before publishing the site
- [ ] Human pass on https://dhilipsiva.dev: `/` is the classic site again (2026-06-11; chat moved to
      **/chat**, /play/ redirects there). On /chat pick `twin`, ask "do you own dhilipsiva.com?"
      (squatter answer) and "what's your phone number?" (refusal); `twinq` → "show me your rust
      projects" opens the projects app; mic permission prompt; voice toggle.
- [ ] Twins still say "the conversation IS his website" (baked system prompt) — fine for now; the
      seeds already say /chat, so the next routine retrain syncs it.
- [ ] Optional hardening: GitHub account Settings → Pages → add dhilipsiva.dev as a **verified domain**.

## Deferred by the owner — future agents, pick up when the trigger fires
- [ ] **Book title — DO NOT disclose yet.** Decision (2026-06-12): the real manuscript title stays
      private until the book is **published**. The site-wide working title "The Fixed Point of Thought"
      is deliberate and good enough for now. TRIGGER to revisit: the book is published (or the owner
      says so). Until then, never invent or surface the real title anywhere (site, seeds, persona).
- [ ] **STGI role details — leave thin for now.** Decision (2026-06-12): the owner just started; the
      `content/things-i-built/stgi.md` page is intentionally short and honest. TRIGGER to revisit:
      a few months in, once there are real war stories to tell. Don't pad it with invented specifics.

## Twin improvements
- [ ] Endgame: candle-cloned voice (TTS is system-voice via speechSynthesis for now) and the
      real fine-tuned voice model slot is already wired for it.
