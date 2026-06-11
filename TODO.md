# TODO

## Before publishing the site
- [x] **Host the fine-tuned GGUFs on Hugging Face** — live at
      https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf (both models + tokenizers + card);
      brain.js points at the resolve URLs. Re-upload after retrains: `finetune/hf_upload.py`.
- [x] Push `source` to origin.
- [ ] Verify the live site after the first Pages deploy (Settings → Pages → Source: GitHub Actions, then
      check dhilipsiva.com: twin loads from HF, mic permission prompt on HTTPS, voice toggle).

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
