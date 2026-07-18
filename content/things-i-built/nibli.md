+++
title = "nibli"
description = "A zero-hallucination symbolic reasoning engine — a hallucination firewall for the LLM era. nibli KR in — a human-readable predicate-call language — first-order logic out; every answer derived, never guessed, with a proof trace on every conclusion."
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
live = "/nibli/"
writeup = true
writeup_label = "write-up"
+++

## Problem

LLMs predict; they don't derive. When the answer has to be *right* — policy, safety, anything with
consequences — a plausible guess is not enough.

## Approach

nibli compiles **nibli KR** — a human-readable predicate-call knowledge-representation language
(`dog(Adam).`, `animal(every dog).`, where every semantic distinction stays visible in the spelling)
— into first-order logic and runs demand-driven backward chaining over it. The pipeline is three
stages: **nibli-kr** parses, **nibli-semantics** compiles the logic, **nibli-reason** derives. Every
conclusion carries its full derivation trace, and names resolve through a committed English corpus
(~1,342 strongly-typed predicate entries), fail-closed. The core is Rust compiled to WebAssembly
(WASI Preview 2). Lojban — the original surface syntax, and still the source of the name (*nibli*:
"logically entails") — was retired at `v0.1-lojban-final` and donated to the fanva repo.

## Outcome

A reasoning engine that cannot hallucinate — it either proves an answer or tells you it can't. One
precision worth being precise about: zero-hallucination means *inference soundness*, not premise
truth. Like Lean or Coq — garbage premises in, garbage conclusions out, but the derivation is always
valid.

**[Try it live at /nibli](/nibli/)** — the real engine compiled to WebAssembly, running the
Transparency Triad in your browser with the book's GDPR and drug-interaction case studies. Every
query returns a proof tree; nothing leaves your tab.
