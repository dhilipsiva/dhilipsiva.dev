+++
title = "nibli"
description = "A zero-hallucination symbolic reasoning engine — a hallucination firewall for the LLM era. Lojban in, first-order logic out; every answer derived, never guessed, with a proof trace on every conclusion."
weight = 1

[extra]
glyph = "∴"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = true
tech = ["Rust", "WASM", "Symbolic Reasoning", "Logic"]
repo = "https://github.com/dhilipsiva/nibli"
demo = "/nibli/"
demo_label = "live demo"
writeup = true
writeup_label = "write-up"
+++

## Problem

LLMs predict; they don't derive. When the answer has to be *right* — policy, safety, anything with
consequences — a plausible guess is not enough.

## Approach

nibli converts Lojban (an unambiguous human language — even the name is a Lojban word meaning
"logically entails") into first-order logic and runs demand-driven backward chaining over it. The
pipeline is three stages, named in Lojban: **gerna** parses, **smuni** does semantics, **logji**
reasons. Every conclusion carries its full derivation trace. The core is Rust compiled to WebAssembly
(WASI Preview 2); a federation layer, **tavla**, propagates knowledge peer-to-peer over browser-native
WebRTC gossip with CRDTs and ed25519-signed envelopes — no central relay.

## Outcome

A reasoning engine that cannot hallucinate — it either proves an answer or tells you it can't. One
precision worth being precise about: zero-hallucination means *inference soundness*, not premise
truth. Like Lean or Coq — garbage premises in, garbage conclusions out, but the derivation is always
valid.

**[Try it live at /nibli](/nibli/)** — the real engine compiled to WebAssembly, running the
Transparency Triad in your browser with the book's GDPR and drug-interaction case studies. Every
query returns a proof tree; nothing leaves your tab.
