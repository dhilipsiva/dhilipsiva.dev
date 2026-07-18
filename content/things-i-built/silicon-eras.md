+++
title = "silicon·eras"
description = "An interactive explorable of consumer-hardware history, 1975–2026 — trace how CPUs, memory, storage, and displays moved across eras on an era-banded chart you can pivot, index, and share by URL. Pure Rust compiled to WebAssembly; the whole dataset is parsed and embedded at build time, so it runs entirely in the browser with no server and no network after load."
weight = 2

[extra]
glyph = "▦"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = true
tech = ["Rust", "WASM", "Dioxus", "Data viz"]
repo = "https://github.com/dhilipsiva/silicon-eras"
live = "/silicon-eras/"
writeup = true
writeup_label = "write-up"
+++

## Problem

Half a century of consumer hardware — CPUs, memory, storage, displays — is a
story of overlapping exponential curves and the eras they define. But the raw
history lives in scattered spec sheets and wiki tables: impossible to *feel* the
trajectories, the plateaus, or where one era handed off to the next. A static
chart flattens it; an interactive one usually means a backend and a data fetch.

## Approach

silicon·eras is a single-page explorable written in pure Rust (Dioxus 0.7),
compiled to WebAssembly. A long-format `dataset.csv` is parsed and typed at
**build time** by `build.rs` and embedded straight into the wasm — so there is no
backend, no API, and no network after the module loads; a data edit flows through
CI with no extra step. The centerpiece is an **era-band trajectory chart**:
envelope or three-line tiers, log/linear and absolute/indexed axes, multiple era
schemes, pins and plateaus, a hover tooltip, an era brush, full keyboard control,
and URL-shareable state so any view can be linked. All colors are `var(--viz-*)`
tokens that inherit the host page's `data-theme`, so it recolors instantly with
the site's light/dark toggle.

## Outcome

A fast, offline-capable way to *see* hardware history move — pivot the axes,
brush an era, share the exact view — with the whole dataset reproducible from one
CSV and the entire app running in your tab.

**[Explore it live at /silicon-eras](/silicon-eras/)** — real Rust compiled to
WebAssembly, the full dataset embedded, nothing leaves your browser.
