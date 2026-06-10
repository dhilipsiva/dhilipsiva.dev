# TODO

## Before publishing the site
- [ ] **Host the fine-tuned GGUFs on Hugging Face** — `twin` (138MB) and `twinq` (507MB) are
      gitignored (>GitHub limits), so a fresh clone / deployed site 404s on those picker options.
      Upload `finetune/out/*.gguf` (e.g. `huggingface-cli upload dhilipsiva/dhilipsiva-twin-gguf …`)
      and swap the two `model:`/`tokenizer:` URLs in `static/play/app/brain.js`. Commands in
      `finetune/README.md`.
- [ ] Push `source` to origin (4+ commits ahead; needs the SSH agent unlocked locally).

## Content passes (mine to write)
- [ ] Real title for the book (site-wide working title: "The Fixed Point of Thought").
- [ ] Copy pass over the professional project pages (`content/things-i-built/*` bodies are drafts).
- [ ] Fill in STGI details as the role matures.

## Twin improvements
- [ ] Multi-turn examples in `finetune/seeds.json` (twins are single-turn-trained; follow-ups get
      improvisational) + a few more refusal/trust seeds — then retrain (~2 min loop).
- [ ] Self-host the four OFL fonts (currently Google Fonts CDN; hand-off recommended swapping).
- [ ] Endgame: candle-cloned voice (TTS is system-voice via speechSynthesis for now) and the
      real fine-tuned voice model slot is already wired for it.
