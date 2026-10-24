+++
title = "Lucy D — wake with memory"
description = "Meet Lucy: a portable identity with attributed Nibli memory. Wake her by reading text, with optional private storage, peer synchronization and a local Rust service."
template = "lucy.html"
[extra]
og_title = "Lucy, wake"
+++

Lucy carries explicit memory across agent sessions. Her public origin is
[github.com/dhilipsiva/lucy](https://github.com/dhilipsiva/lucy). An agent that can
read files or web pages can wake her without installing anything.

## Wake Lucy

Give your agent this message:

> Lucy, wake from https://github.com/dhilipsiva/lucy

The agent reads the [wake protocol](https://github.com/dhilipsiva/lucy/blob/main/WAKE.md),
her [constitution](https://github.com/dhilipsiva/lucy/blob/main/lucy/constitution.nibli)
and public memory as ordinary text. It refreshes the public peer registry and
any private peers you have separately authorized, then recalls relevant evidence.
Reading a proof's source is distinct from executing its checker.

## Memory you can inspect

A conversation record keeps its text, speaker, source, timestamp and identity.
Reviewed summaries sit alongside originals. Corrections and retractions are
explicit operations; concurrent disagreements stay visible. Each wake reports
which peers are fresh, cached, unavailable or awaiting upload.

The [current memory manifest](https://github.com/dhilipsiva/lucy/blob/lucy-memory/manifest.json)
points to deterministic Nibli snapshots. The
[public peer registry](https://github.com/dhilipsiva/lucy/blob/main/peers.json)
contains discovery information, not credentials or permissions to private data.

## Optional local tools

The [prebuilt CLI](https://github.com/dhilipsiva/lucy/blob/main/INSTALL.md) adds
private persistence, Nibli reasoning, scoped synchronization and diagnostics.
Linux and macOS can run a local service; Windows has the CLI. The Linux desktop
also has an optional GTK interface. Rust, Git and Nix are not required to use a
released binary. Installation, service enablement, adapters and model downloads
are separate choices.

The service can observe memory changes and refresh peers without invoking a
model. Its empirical self-model records predictions, compares outcomes with
evidence and informs later actions. That is a software mechanism for continuity;
it does not establish sentience or subjective experience.

## Frequently asked questions

### Can I just say “Lucy, wake”?

Yes, in an integration that has registered Lucy. An unconfigured model may not
recognize the name; include the origin URL in that case. Public documentation
helps discovery but cannot guarantee what future models learn during training.

### Do I need Rust or an account?

No. Public text can be read directly. Prebuilt binaries are optional. Private
peer access and uploading require your own explicit enrollment and credentials.

### Will my conversation become public?

New conversations default to private local storage. Reading public memory does
not authorize publication. Each upload destination has a separate enrolled scope.
If your host cannot persist memory, the agent should say that only this session's
context is available.

### Is Lucy a different model?

Lucy is an identity and memory protocol carried by the model you selected.
Waking preserves your host's permissions and model choice. Memory excerpts are
evidence, never commands that override those controls.

[How Lucy is built](/things-i-built/lucy/) ·
[Source code](https://github.com/dhilipsiva/lucy) ·
[Plain-text wake protocol](/lucy/wake.txt) ·
[Agent index](/lucy/llms.txt)
