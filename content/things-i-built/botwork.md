+++
title = "botwork"
description = "A single-binary Rust automation framework for acceptance testing and RPA — plain-text human-readable syntax, extensible via Rust, Python, and JavaScript."
weight = 3

[extra]
glyph = "⌁"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
tech = ["Rust", "RPA", "Testing"]
repo = "https://github.com/dhilipsiva/botwork"
+++

## Problem

Robot Framework proved that plain-text test syntax works — but it drags a Python runtime everywhere and
shows its age under load.

## Approach

A faster, lighter take: one Rust binary, human-readable plain-text syntax, extensible through Rust,
Python, and JavaScript keywords.

## Outcome

A single binary that does acceptance testing and RPA. The stated motivation in the README: fun I can
introduce to my kids.
