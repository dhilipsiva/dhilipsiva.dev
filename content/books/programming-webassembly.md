+++
title = "Programming WebAssembly with Rust"
description = "A hands-on tour of compiling Rust to Wasm and shipping it to the browser and the edge."
weight = 3

[extra]
kind = "reviewed"
author = "Kevin Hoffman"
rating = "★★★★☆"
featured = false
blurb = "A hands-on tour of compiling Rust to Wasm and shipping it everywhere. Solid foundations; I review where it holds up and where the ecosystem has since moved."
+++

A hands-on tour of compiling Rust to WebAssembly and shipping it to the browser and beyond — the book I
point people at when they ask where to start with Rust + Wasm.

## Verdict

Solid foundations: the mental model of Wasm as a portable, sandboxed compilation target is taught well,
and the Rust toolchain walkthroughs still orient you correctly. But the ecosystem has moved on hard since
publication — the component model, WASI Preview 2, and WIT interfaces (the substrate nibli targets, and
what this site's own in-browser models run on) all post-date it. Read it for the foundations, then go
straight to the current WASI/component-model docs for everything after the borders of the book. Four
stars: aging, honestly.
