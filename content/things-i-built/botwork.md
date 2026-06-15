+++
title = "botwork"
description = "A single-binary Rust automation framework for acceptance testing and RPA — plain-text human-readable syntax, extensible via Rust, Python, and JavaScript."
weight = 2

[extra]
glyph = "⌁"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = true
tech = ["Rust", "RPA", "Testing"]
repo = "https://github.com/dhilipsiva/botwork"
+++

## Problem

Robot Framework proved the thesis: plain-text, human-readable test syntax is the right interface for
acceptance testing and RPA. But it drags a whole Python runtime everywhere it goes — slow to start,
heavy to install, and it shows its age under load.

## Approach

Keep the idea, drop the weight. botwork is a single Rust binary: the same plain-text spirit, but it
starts fast and installs nowhere. Keywords are extensible from three directions — native **Rust**,
**Python** (via PyO3), and **JavaScript** (via neon) — so you reach for whichever language the job
actually wants, without leaving the runner.

## Outcome

One binary that does both acceptance testing and RPA, with far less ceremony per test. The stated
motivation in the README is the honest one: it's fun, and it's a thing I can introduce to my kids.
