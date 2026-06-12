# TODO

## From the site review (2026-06-12, rated 8/10 — concept 10, content depth 6.5, first-visit clarity 6)
The hard parts are done; what's left is making them visible and finishing the copy.
- [x] **Sell the wow above the fold** (2026-06-12): the hero panel now has a phosphor "live demos —
      this page ships its own AI. Nothing leaves your tab." strip above the two demo rows, and the
      row descriptions are plain English ("a neural network fine-tuned to impersonate me, running in
      your browser" / "a reasoning engine that proves every answer — or refuses to answer").
- [ ] **A 30-second guided moment on /nibli.** The pieces exist (examples, queries, scenarios) but a
      cold visitor doesn't know what to click first. An "start here" flow — load GDPR → run one query
      → withdraw consent → watch the flip — would land the point without reading anything.
- [ ] **Close the scripted-vs-twin gap on /chat.** Most visitors never download the 145MB model and
      leave thinking the chat is a keyword bot. Make the scripted layer say so explicitly ("you're on
      the scripted index — load the real twin to see the trick"), and consider auto-suggesting the
      twin on good connections.
- [ ] **Label the era on old musings.** The imported 2012–2021 articles sit at a very different
      quality level than the launch essay; a small "from the archive, <year>" badge sets expectations.
- [ ] Content depth items below (copy pass, book title, STGI) are the other half of the score gap.

## /nibli live demo
- The engine wasm is built from the nibli repo (WSL): `wasm-pack build nibli-wasm --release --target web`,
  then copy `nibli-wasm/pkg/nibli_wasm{.js,_bg.wasm,.d.ts}` → `static/nibli/wasm/`. The `nibli-wasm`
  crate is committed in the nibli repo (NOT pushed yet — push when ready).
- KNOWN ENGINE ISSUE (upstream, in logji): the Ch20 breach-notification query
  (`la .akmes. cu se bilga lo nu notci`) against the FULL gdpr.lojban corpus does not return in
  bounded time even in release (>240s, traced path) — matches the code-review-panel suspicion.
  Excluded from the demo; fix belongs in the nibli repo.

## Before publishing the site
- [x] **Host the fine-tuned GGUFs on Hugging Face** — live at
      https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf (both models + tokenizers + card);
      brain.js points at the resolve URLs. Re-upload after retrains: `finetune/hf_upload.py`.
- [x] Push `source` to origin.
- [x] Register **dhilipsiva.dev** (done 2026-06-11, Cloudflare Registrar).
      dhilipsiva.com is LOST to a squatter (owned ~20 years, missed the renewal) — never link to it.
- [x] Bind the domain (2026-06-11): Pages enabled via API (`build_type=workflow`), custom domain set,
      deploy green, https://dhilipsiva.dev live. DNS is **Cloudflare-proxied** (orange cloud) — works,
      but set SSL/TLS mode to **Full** + enable **Always Use HTTPS** in Cloudflare; GitHub's own cert
      stays unprovisioned in this mode (fine — Cloudflare terminates TLS).
- [ ] Human pass on https://dhilipsiva.dev: `/` is the classic site again (2026-06-11; chat moved to
      **/chat**, /play/ redirects there). On /chat pick `twin`, ask "do you own dhilipsiva.com?"
      (squatter answer) and "what's your phone number?" (refusal); `twinq` → "show me your rust
      projects" opens the projects app; mic permission prompt; voice toggle.
- [ ] Twins still say "the conversation IS his website" (baked system prompt) — fine for now; the
      seeds already say /chat, so the next routine retrain syncs it.
- [ ] Optional hardening: GitHub account Settings → Pages → add dhilipsiva.dev as a **verified domain**.

## Content passes (mine to write)
- [ ] Real title for the book (site-wide working title: "The Fixed Point of Thought" — kept on purpose,
      2026-06; the manuscript title stays private until launch).
- [ ] Copy pass over the project pages (`content/things-i-built/*` bodies are drafts — including the new
      botwork / webapp-checklist pages).
- [ ] Fill in STGI details as the role matures.

## Twin improvements
- [x] Multi-turn examples (`finetune/multi_seeds.json` + `tool_multi_seeds.json`, trained since v6;
      twins follow context now).
- [x] Self-host the four OFL fonts (42 woff2 under `static/assets/fonts/`, done with the v6 arc).
- [ ] Endgame: candle-cloned voice (TTS is system-voice via speechSynthesis for now) and the
      real fine-tuned voice model slot is already wired for it.
- [ ] **Context-aware quick actions on /chat.** The suggestion chips (`SUGGESTIONS` +
      `wireSuggestions()` in `static/play/app/chat.js`) are static; they should adapt to the last
      question/answer — e.g. after a nibli answer offer "try the live demo" and "why Lojban?",
      after a career answer offer "show me the projects". Likely a topic → follow-ups map keyed off
      the matched knowledge.js topic (scripted) or the routed app (twins), with the static list as
      the cold-start default.
