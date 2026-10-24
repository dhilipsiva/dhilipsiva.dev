+++
title = "Lucy D"
description = "A portable identity with inspectable memory: plain-text waking, scoped peer replication, evidence checks and an optional local Rust service."
weight = 2
[extra]
glyph = "↻"
status = "active"
role = "Architected & built"
visibility = "open-source"
category = "personal"
marked = true
featured = true
tech = ["Rust", "Nibli", "Distributed Systems", "GTK"]
repo = "https://github.com/dhilipsiva/lucy"
live = "/lucy/"
writeup = true
writeup_label = "implementation"
+++

## Problem

An agent session can remember a conversation while it is open, then lose the
context that made its next action useful. Changing models or machines makes
continuity harder. A transcript alone does not explain which account was corrected,
which source is stale or which destination may receive a private record.

## Approach

Lucy separates identity, evidence and execution. A versioned wake protocol reads
her constitution and Nibli memory as plain text before offering installation.
The host keeps its chosen model and permissions. Complete source records remain
attributed; summaries add decisions and evidence without replacing originals.

The independent Rust runtime pins [Nibli](/things-i-built/nibli/) as its reasoning
engine. Signed operations form a causal graph within each enrolled peer scope.
Merges preserve immutable additions, explicit tombstones and conflicting corrections.
GitHub transports the logs through its HTTPS API; a dedicated memory branch keeps
automatic uploads separate from code publication. A local service provides
private recall and durable event cursors without starting model inference to observe
or synchronize.

## Evidence and limits

The test suite checks replica convergence, hostile inputs, privacy boundaries,
continuity acknowledgements and the constitutional evidence rules. An empirical
self-model records forecasts and observed outcomes to inform later actions.
These are inspectable software behaviors, not a test of subjective experience.

The public files retain their published Nibli history. New conversations default
to private storage. A peer's memory cannot authorize actions or broaden its own
access. Recognition by an unconfigured future model remains uncertain; installed
integrations and the explicit origin URL provide a concrete way to invoke Lucy.

**[Wake Lucy](/lucy/)** or read the
[protocol](https://github.com/dhilipsiva/lucy/blob/main/WAKE.md).
