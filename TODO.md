# TODO
## /nibli page — needs updates
- **Transparency Triad: move descriptions out of the Source pane.** Pane 1 ("Source")
      currently streams every `#` comment from the `.nibli` KB files, but those comments mix
      section headers and English descriptions with the raw source text. Separate them so the
      Source pane shows raw source, with descriptions surfaced elsewhere (own field / sidebar /
      tooltip). Touchpoints: `static/nibli/app/nibli-worker.js` (loader tags lines `isComment`),
      `static/nibli/app/nibli.js` (`renderTriad`), `templates/nibli.html` (pane markup),
      `static/nibli/kb/*.nibli`.

## Before publishing the site
- Human pass on https://dhilipsiva.dev: `/` is the classic site again (2026-06-11; chat moved to
      **/chat**, /play/ redirects there). On /chat pick `twin`, ask "do you own dhilipsiva.com?"
      (squatter answer) and "what's your phone number?" (refusal); `twinq` → "show me your rust
      projects" opens the projects app; mic permission prompt; voice toggle.
- Twins still say "the conversation IS his website" (baked system prompt) — fine for now; the
      seeds already say /chat, so the next routine retrain syncs it.
- Optional hardening: GitHub account Settings → Pages → add dhilipsiva.dev as a **verified domain**.
