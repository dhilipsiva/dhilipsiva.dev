+++
title = "dhilipsiva.dev"
description = "This website — a Zola static site that ships its own AI: two LoRA fine-tuned twins and the real nibli engine, all running in your tab via Rust→WASM. The site is its own demo, and the source is open — training pipeline included."
weight = 3

[extra]
glyph = "↻"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = true
tech = ["Rust", "WASM", "Zola", "LoRA"]
repo = "https://github.com/dhilipsiva/dhilipsiva.dev"
+++

## Problem

A personal site is usually a brochure. I wanted one that demonstrates the thesis instead of stating
it — that the gap between *fluent* and *true* is real, and that the honest way to ship AI is
on-device, inspectable, and open.

## Approach

A Zola static site on the QUINE design system, zero backend. The AI stack runs entirely in your
browser: [candle](https://github.com/huggingface/candle) (Rust compiled to WebAssembly) drives two
LoRA fine-tunes of me at [/chat](/chat/) — a SmolLM2-135M and a Qwen2.5-0.5B that opens the site's
apps itself — plus Whisper voice input. The real [nibli](/nibli/) engine runs the Transparency Triad
at /nibli, proof trees and all.

## Outcome

You're looking at it. A quine of a website: the repo contains the instructions for building itself,
including `finetune/` — the follow-along runbook that turns a fact sheet and some seed answers into
the model impersonating me. Everything is open source, training data included.
