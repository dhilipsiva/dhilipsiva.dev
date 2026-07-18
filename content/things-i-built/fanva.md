+++
title = "fanva"
description = "An agentic English→Lojban translator that produces *verified* Lojban: an LLM drafts a translation, three real Lojban compilers reject anything invalid, and the exact compiler error is fed back to the model until the output passes every gate. Runs entirely in your browser — bring your own LLM key, no server, and the grammar/semantics gates run on-device with zero network."
weight = 2

[extra]
glyph = "⇌"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = false
tech = ["Rust", "WASM", "Dioxus", "Lojban", "LLM"]
repo = "https://github.com/dhilipsiva/fanva"
live = "/fanva/"
writeup = true
writeup_label = "write-up"
+++

## Problem

Ask an LLM to translate English into Lojban — a constructed language with a
machine-checkable grammar — and it will confidently hand you something that
*looks* like Lojban and doesn't parse. The whole point of Lojban is that validity
is decidable; a translator that only *probably* produces grammatical output throws
away the one guarantee the language offers.

## Approach

fanva (Lojban: *translate*) closes the loop with real compilers instead of trust.
An LLM drafts a candidate, and every draft must pass **three independent local
gates**: **gerna** (a strict Rust grammar parser — the narrowest gate), **smuni**
(semantics/arity, compiling to first-order logic), and **camxes** (the official
ilmentufa grammar, run in-browser). On any failure, the *exact* compiler error is
appended to the conversation and the model retries — bounded by an attempt budget,
an oscillation guard, and history trimming. The success condition is the
intersection **gerna ∧ smuni ∧ camxes**, with an advisory fresh-context LLM judge
back-translating each line as a final semantic check. The whole thing runs as a
Dioxus WASM app: bring your own LLM key (Anthropic / OpenAI / OpenRouter / Gemini /
any OpenAI-compatible endpoint), held only in an in-memory signal and sent only to
your chosen provider — the deterministic gates run on-device with zero network.

## Outcome

Lojban you can trust: output that a strict fragment parser accepts, that compiles
to well-formed logic, and that the official grammar validates — with a visible
self-correction trace showing every attempt and the three gate chips, plus a
back-translation view. No fanva server, no shared key, nothing leaves your tab but
your own model requests.

**[Try it live at /fanva](/fanva/)** — the real translator compiled to WebAssembly,
the three Lojban gates in your browser. Bring your own LLM key; nothing else leaves
your tab.
