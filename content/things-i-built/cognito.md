+++
title = "cognito"
description = "A pure-Rust System 2 reasoning kernel — a failed experiment in a transformer that thinks in explicit steps. The premise survived; the execution didn't. The lessons moved into nibli."
weight = 6

[extra]
glyph = "∇"
status = "failed"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
tech = ["Rust", "Burn", "AI Reasoning"]
repo = "https://github.com/dhilipsiva/cognito"
+++

A high-density reasoning agent in pure Rust, built on the Burn framework: a decoder-only transformer with a
tool-native cognitive loop (`<think>`, `<call>`, `<result>`) that targets reasoning over factual recall.

The premise: most of what a large model memorizes is recallable from tools; what can't be outsourced is the
*thinking*. So cognito spends its parameters on System 2 — explicit, stepwise reasoning — and treats
knowledge as something you call, not something you are.

## Post-mortem

It failed. The premise still looks right to me; the execution didn't survive contact with reality —
training a reasoning-first transformer from scratch is a lab's worth of work, not an evening's worth
of conviction. The repo stays public because failure is data, and the instinct it encoded — that
thinking and knowing are separable — moved into [nibli](/things-i-built/nibli/), approached from the
symbolic side instead.
