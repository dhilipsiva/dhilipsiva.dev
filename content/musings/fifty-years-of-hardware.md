+++
title = "I compiled fifty years of hardware history into your browser"
date = 2026-07-18
description = "silicon·eras is an interactive explorable of consumer-hardware history, 1975–2026 — pure Rust compiled to WebAssembly, the whole dataset parsed and embedded at build time, no server and no network after load. Why the data lives in the binary, and how one CSV becomes an era-banded chart you can pivot and share by URL."

[taxonomies]
tags = ["rust", "wasm", "dioxus", "data-viz"]

[extra]
type = "essay"
+++

Half a century of consumer hardware — CPUs, memory, storage, displays — is a story of
overlapping exponential curves and the eras they define. But that story usually lives in
scattered spec sheets and wiki tables, where you can read a number but never *feel* the
trajectory. [silicon·eras](/silicon-eras/) is my attempt to make it something you can move
through: an era-banded chart from 1975 to 2026 that you pivot, index, brush, and link. It
runs entirely in your tab — pure Rust compiled to WebAssembly, no backend, no data fetch.
This post is the build log.

## The data lives in the binary

The interesting decision is where the dataset goes. silicon·eras has no API and makes no
network request after the wasm loads — because the entire dataset is compiled *into* it.

A long-format `dataset.csv` is the single source of truth. A `build.rs` step parses and
types it at build time, serializes the result to JSON in `OUT_DIR`, and the app pulls it in
with one `include_str!`. The parser is `rerun-if-changed`-keyed to the CSV, so editing a row
— say, a PR that fixes a launch price — flows straight through CI to the deployed app with
no extra step and nothing to keep in sync at runtime. Genuine parse failures surface as
`cargo::warning=` lines instead of silently shipping bad data.

The trade is deliberate: a slightly larger wasm in exchange for zero latency, zero
backend, and a build that fails loudly if the data is malformed. For a fixed historical
dataset, that's the right trade.

## One CSV, one chart, many views of it

The workspace splits the concerns: `silicon-parse` turns the CSV into typed records,
`silicon-model` holds the domain types, `silicon-viz` does the geometry, and the Dioxus
`app` crate is the UI. The first view — "trajectories" — is an era-banded chart with a
handful of orthogonal controls, each of which changes the *question* rather than the data:

- **log / linear** — see order-of-magnitude jumps, or absolute deltas.
- **absolute / indexed** — raw values, or everything normalized to a common start so you
  compare *rates*.
- **era schemes** — reslice the same fifty years by different definitions of an "era."
- **pins, plateaus, and an era brush** — mark a moment, or focus a span.

All of it is reflected in the URL, so any particular view is a link you can share and land
back on exactly.

## It borrows the page's theme, not its own

silicon·eras ships no theme toggle of its own. Every color is a `var(--viz-*)` token, and
the whole palette keys off the host page's `data-theme` attribute. So when you flip this
site's light/dark switch, the explorable recolors with it — the site owns the theme, the
app just inherits it. It's the same trick the rest of the site's embedded Rust apps use,
and it means one toggle controls everything.

## What it is, and isn't, yet

This is the first view of an ongoing explorable, and it's honest about its limits: it's
desktop-first (the chart wants ≥880px of width), and on a phone it falls back to a
read-only summary rather than pretending a dense multi-axis chart works at 375px. More
views will follow the same shape — CSV in, typed at build time, embedded, pivoted in the
browser.

**[Explore it live at /silicon-eras](/silicon-eras/)** — real Rust compiled to
WebAssembly, the whole dataset embedded, nothing leaves your tab. The source is on
[GitHub](https://github.com/dhilipsiva/silicon-eras).
