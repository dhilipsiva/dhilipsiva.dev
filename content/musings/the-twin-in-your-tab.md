+++
title = "I fine-tuned myself into my website"
date = 2026-06-11
description = "This site's chat is a LoRA fine-tune of me, running entirely in your browser — candle compiled from Rust to WebAssembly, no servers, no cookies. How it works, what it cost, and the three lessons that made a 135M-parameter twin stop rambling."

[taxonomies]
tags = ["rust", "wasm", "llm", "ai"]

[extra]
type = "essay"
pinned = true
+++

If you open [/chat](/chat/) on this site and pick `dhilipsiva-twin` from the model picker, your browser
downloads a 145MB file and starts impersonating me. Nothing goes back up. There is no inference server,
no API key, no analytics, no cookie banner — the model runs in your tab, on your hardware, and when you
close the tab the conversation is gone. This post is the build log.

## The runtime: candle, compiled from Rust to WebAssembly

The inference engine is [candle](https://github.com/huggingface/candle) — Hugging Face's Rust ML
framework — compiled to WebAssembly with `wasm-pack`. The crate is small: a quantized-LLM wrapper and a
Whisper wrapper behind one surface, about 5.5MB of wasm, committed to the repo so CI needs no Rust
toolchain at all.

Two details took real debugging:

**GGUF architecture auto-detection.** The site offers four models — two fine-tuned twins plus stock
SmolLM2 and Qwen2.5 — and they span two architectures. Rather than hardcoding, the loader reads
`general.architecture` from the GGUF metadata and dispatches to `quantized_llama` or `quantized_qwen2`.
A fine-tuned model is a one-line entry in a config object.

**Single-threaded everything.** Browsers only give WebAssembly threads behind COOP/COEP headers, which
GitHub Pages doesn't serve. The LLM path is fine single-threaded with simd128, but candle's Whisper
preprocessing spawns OS threads for the mel spectrogram — which compiles fine and then traps with
`unreachable` at runtime. The fix is a vendored single-threaded mel implementation. Speech-to-text runs
on-device too: hold the mic, MediaRecorder captures audio, an OfflineAudioContext resamples to 16kHz,
and Whisper tiny.en (~40MB, quantized) transcribes in the same wasm module.

## The twins: LoRA on a 135M and a 0.5B

The persona models are LoRA fine-tunes — rank 32, alpha 64, lr 2e-4, **24 epochs** — of
SmolLM2-135M-Instruct and Qwen2.5-0.5B-Instruct, trained on a few hundred hand-written Q/A pairs on an
RTX 5090. A training run takes about two minutes, which changes your relationship with the loop
entirely: editing the dataset feels like editing copy.

Three lessons cost me an evening each:

**1. Mask the prompt, train the stop.** Naive full-sequence loss taught the model to keep generating
forever. The fix: label every prompt token `-100` and train only on the assistant answer *plus its
`<|im_end|>` terminator*. The model learns to say its piece and stop.

**2. The system prompt is part of the weights.** Recall is conditioned on the training system prompt —
change one character at inference and the model's memory of itself degrades. The training string and
the runtime string are the same constant, byte for byte, and the README now says so in bold.

**3. Don't penalize the prompt.** The repeat-penalty originally ranged over the whole context — including
the system prompt, which contains my name. The twin became unable to say "dhilipsiva". The penalty now
applies only to generated tokens.

The Qwen twin learns one extra trick: it ends browse-y answers with a line like
`TOOL {"app":"projects","params":{"filter":"rust"}}`, which the page parses and renders as an inline
app — projects, books, musings, talks — MCP-style, but with the tool calls baked into the weights
rather than prompted. A deterministic keyword router backstops it, so even the scripted no-model mode
opens the right cards.

## The honest part

A 135M-parameter model fine-tuned to impersonate a person is a **persona parrot, overfit on purpose**.
Greedy decoding surfaces the baked answers; anything off the map is improvisation, delivered with
perfect confidence. That's why the banner at the top of the chat says what it says: *this on-device AI
will lie, confidently.* Fluency and truth are different axes, and a small model is the gap made
tangible.

That gap is also, not coincidentally, my actual obsession. The serious answer to it isn't a bigger
parrot — it's [nibli](/things-i-built/nibli/), a symbolic reasoning engine that derives conclusions
with proof traces instead of predicting plausible text. The twin is the demo of the problem; nibli is
the attempt at the solution. The website gets to be both.

## Numbers, for the benchmark-minded

- Twin (SmolLM2-135M, q8_0): 145MB, loads once, cached by the browser.
- Qwen twin (0.5B, q8_0): 531MB — noticeably better at staying on script and it opens the apps itself.
- Dataset: ~270 hand-written examples after expansion; multi-turn conversations included so follow-ups
  stay in context.
- Training: ~2 min (135M) / ~5 min (0.5B) per run on one RTX 5090.
- Whisper tiny.en: ~40MB, transcribes a few seconds of speech in roughly real time, single-threaded.
- Conversation history: ephemeral, in-memory, capped — nothing persists, nothing leaves.

Everything is open: the [site source](https://github.com/dhilipsiva/dhilipsiva.dev), the
[models](https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf), and the fine-tune pipeline (a
follow-along runbook lives in the repo's `finetune/` directory). If you build a twin of yourself, I'd
genuinely like to hear how it lies about you.
