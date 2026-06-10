# TODO

## Before publishing the site
- [x] **Host the fine-tuned GGUFs on Hugging Face** — live at
      https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf (both models + tokenizers + card);
      brain.js points at the resolve URLs. Re-upload after retrains: `finetune/hf_upload.py`.
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
