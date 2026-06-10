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
writeup = true
writeup_label = "write-up"
diagram = "SLOT: diagram · Lojban → FOL → backward-chaining inference → proof trace"
+++

## Problem

LLMs predict; they don't derive. When the answer has to be *right* — policy, safety, anything with
consequences — a plausible guess is not enough.

## Approach

nibli converts Lojban (an unambiguous human language) into first-order logic and runs a deterministic
backward-chaining theorem prover over it. Every conclusion carries its full derivation trace. The core is
Rust compiled to WebAssembly (WASI Preview 2), with federated knowledge propagation via CRDTs and signed gossip.

## Outcome

A reasoning engine that cannot hallucinate — it either proves an answer or tells you it can't. 661 unit
tests. Apache-2.0. *(Body copy is a working draft — refine in your own words.)*
