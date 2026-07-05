+++
title = "voksa"
description = "A pure-Rust, rule-based Lojban speech synthesizer that runs entirely in the browser — Lojban text in, natural speech out, no server and no network after load. Ships a tuning console for crowdsourcing the voice; every config replays bit-identically on the native CLI."
weight = 2

[extra]
glyph = "ʋ"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = true
tech = ["Rust", "WASM", "Dioxus", "Speech Synthesis", "Audio (Klatt)"]
repo = "https://github.com/dhilipsiva/voksa"
live = "/voksa/"
writeup = true
writeup_label = "write-up"
+++

## Problem

Lojban is a spoken language with no voice. Text-to-speech for a constructed,
phonetically-regular language shouldn't need a neural net or a server — but it
also shouldn't sound like a 1980s formant synth read from a table nobody agreed on.

## Approach

voksa is a rule-based Klatt-style formant synthesizer written in pure Rust,
compiled to a ~42 KB, zero-import WebAssembly module that runs the whole synthesis
on the browser's main thread (< 100 ms per sentence) and plays through a tiny
AudioWorklet — no network after load. The interesting part is *tuning*: the CLL
defines what an attitudinal *means* but never how it *sounds*, so the prosody,
naturalness, and per-phoneme voice tables are voksa's invention. The **tuning
console** (a Dioxus component) exposes all 449 parameters with Lojban-labeled
controls and English glosses, a live phonetic-analysis line, and an export/load
loop: fiddle the voice, listen, and share a config JSON back to the community
that replays bit-identically on the native CLI.

## Outcome

Offline Lojban speech in any browser, and a way for the Lojban community to
converge on how the language should actually sound — by ear, together, with every
tuning reproducible from a small JSON file.

**[Try it live at /voksa](/voksa/)** — the real engine compiled to WebAssembly,
the full tuning console in your browser. Nothing leaves your tab.
