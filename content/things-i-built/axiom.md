+++
title = "axiom"
description = "A symbolic-reasoning kernel in Rust that compiles proofs to a 12kB Wasm core. Express your invariants as logic and it proves the topology before anything runs."
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
repo = "#repo"
live = "#live"
writeup = true
writeup_label = "write-up"
diagram = "SLOT: diagram · proof pipeline → Wasm core"
+++

## Problem

Most systems discover their invariants the hard way — in production, at 3am. The interesting
properties of a distributed system (safety, liveness, convergence) are *logical* facts, but we
usually encode them as imperative checks scattered across the codebase.

## Approach

axiom lets you state invariants as first-order logic and compiles the proof obligations to a tiny,
deterministic Wasm core. The kernel is small enough to read in an afternoon and port anywhere a
Wasm runtime exists.

## Outcome

A 12kB reasoning core with full proof traces — every conclusion carries its derivation. Placeholder
copy; swap for the real write-up.
