# TODO

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
      thirukural-ai / botwork / webapp-checklist pages).
- [ ] Real press links for thirukural.ai (Deccan Herald, Swarajya) on its page.
- [ ] Fill in STGI details as the role matures.

## Twin improvements
- [ ] Multi-turn examples in `finetune/seeds.json` (twins are single-turn-trained; follow-ups get
      improvisational) + a few more refusal/trust seeds — then retrain (~2 min loop).
- [ ] Self-host the four OFL fonts (currently Google Fonts CDN; hand-off recommended swapping).
- [ ] Endgame: candle-cloned voice (TTS is system-voice via speechSynthesis for now) and the
      real fine-tuned voice model slot is already wired for it.
