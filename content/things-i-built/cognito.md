+++
title = "cognito"
description = "A pure-Rust System 2 reasoning kernel — minimal knowledge, maximal logic. A transformer that thinks in explicit steps: think, call, result."
weight = 2

[extra]
glyph = "∇"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = true
tech = ["Rust", "Burn", "AI Reasoning"]
repo = "https://github.com/dhilipsiva/cognito"
+++

A high-density reasoning agent in pure Rust, built on the Burn framework: a decoder-only transformer with a
tool-native cognitive loop (`<think>`, `<call>`, `<result>`) that targets reasoning over factual recall.

The premise: most of what a large model memorizes is recallable from tools; what can't be outsourced is the
*thinking*. So cognito spends its parameters on System 2 — explicit, stepwise reasoning — and treats
knowledge as something you call, not something you are. The sibling instinct to
[nibli](/things-i-built/nibli/), approached from the neural side.
