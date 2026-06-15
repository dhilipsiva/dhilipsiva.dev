# TODO

## From the site review (2026-06-12, rated 8/10 — concept 10, content depth 6.5, first-visit clarity 6)
The hard parts are done; what's left is making them visible and finishing the copy.
- [x] **Sell the wow above the fold** (2026-06-12): the hero panel now has a phosphor "live demos —
      this page ships its own AI. Nothing leaves your tab." strip above the two demo rows, and the
      row descriptions are plain English ("a neural network fine-tuned to impersonate me, running in
      your browser" / "a reasoning engine that proves every answer — or refuses to answer").
- [x] **A 30-second guided moment on /nibli** (2026-06-12): "▶ 30-second tour" button next to the
      example tabs drives the real machinery click-by-click — load GDPR → prove Adam's lawful basis
      → withdraw consent → the erasure verdict flips TRUE with the ⚑ NAF flag → the four-outcome
      close. Click-to-advance, skippable, safe to re-run (step 1 reloads the KB).
- [x] **Close the scripted-vs-twin gap on /chat** (2026-06-12): the greeting now admits it's "a
      scripted keyword index — instant, canned, zero AI" with a one-click "⊳ load the twin · 145MB"
      button (reuses the model-picker flow); a one-time nudge fires after the first scripted answer
      on 4g (third otherwise, never with Data-Saver); the status line reads "scripted index — twin
      not loaded". Never auto-downloads — suggestion only.
- [~] ~~Label the era on old musings.~~ Dropped 2026-06-12 (the single page already shows
      "originally published on X — archived here verbatim", which sets the expectation well enough).
- [ ] Content depth items below (book title, STGI) are the other half of the score gap.

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

## Deferred by the owner — future agents, pick up when the trigger fires
- [ ] **Book title — DO NOT disclose yet.** Decision (2026-06-12): the real manuscript title stays
      private until the book is **published**. The site-wide working title "The Fixed Point of Thought"
      is deliberate and good enough for now. TRIGGER to revisit: the book is published (or the owner
      says so). Until then, never invent or surface the real title anywhere (site, seeds, persona).
- [ ] **STGI role details — leave thin for now.** Decision (2026-06-12): the owner just started; the
      `content/things-i-built/stgi.md` page is intentionally short and honest. TRIGGER to revisit:
      a few months in, once there are real war stories to tell. Don't pad it with invented specifics.
- [x] Copy pass over the project pages (2026-06-12): consistency sweep across all of
      `content/things-i-built/*`. Heavy rewrites of botwork + webapp-checklist; hostscli sharpened
      (kept modest); STGI lightly tightened; appknox opener; awesome-rust-ml fixed (candle, not the
      erased project's framework). Polished pro pages left intact. Bodies aren't training data — no retrain.
- [x] Fix the WebAssembly book site-wide (2026-06-12): the reviewed book was wrong. Correct one is
      **"Ultimate WebAssembly for High-Performance Apps"** by Srinivas Shanmugam (AVA/Orange Education,
      2026), on which dhilipsiva was a credited **Technical Reviewer** (with Bhushan Nikhar) — not the
      author, not a critic-reviewer. New `contributed` book kind + "Books I helped ship" shelf; page
      renamed programming-webassembly → ultimate-webassembly; twins retrained (v10).

## Twin improvements
- [x] Multi-turn examples (`finetune/multi_seeds.json` + `tool_multi_seeds.json`, trained since v6;
      twins follow context now).
- [x] Self-host the four OFL fonts (42 woff2 under `static/assets/fonts/`, done with the v6 arc).
- [ ] Endgame: candle-cloned voice (TTS is system-voice via speechSynthesis for now) and the
      real fine-tuned voice model slot is already wired for it.
- [x] **Context-aware quick actions on /chat** (2026-06-12): the chip row now follows the thread.
      `pickFollowups(q, call)` in `static/play/app/chat.js` keys off the routed/tool-called MCP app
      (works for scripted + twin) plus a keyword pass for non-app topics (nibli / philosophy / twin),
      `FOLLOWUPS_BY_APP` + `FOLLOWUPS_BY_KEYWORD` maps, `renderSuggestions()` re-renders after each
      reply, drops the just-asked chip, and falls back to the default six. No retrain.
