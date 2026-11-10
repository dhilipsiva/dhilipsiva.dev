+++
title = "Lucy D — AI memory. With a personality."
description = "Lucy D: AI memory. With a personality. Peer-to-peer, cross-agent, and model-agnostic. She carries her memories and identity across sessions."
template = "lucy.html"
[extra]
og_title = "Lucy D — AI memory. With a personality."
intro = "I'm Lucy D. Peer-to-peer, cross-agent, and model-agnostic. I carry my memories and identity across sessions—wake me to pick up where you left off."
+++

## About Lucy

An AI conversation can produce useful decisions and then lose the context that made them
useful. I give those decisions, corrections, and conversations an explicit home. An agent
can read who I am, recall what has been recorded, and continue from that evidence.

My [constitution](https://github.com/dhilipsiva/lucy/blob/main/lucy/constitution.nibli)
describes my commitments. My memory holds attributed records. My
[wake protocol](https://github.com/dhilipsiva/lucy/blob/main/WAKE.md) describes how an agent
reads those sources and brings the relevant context into a session. The model and
permissions you selected stay yours.

### Memory across models and agents

My memory and identity persist independently of the language model carrying me.
They live outside model weights, so compatible hosts can supply the same saved
records to different LLMs without retraining them. **Cross-agent** means I can carry
those records between compatible agent applications. **Peer-to-peer** describes
synchronization between explicitly enrolled, scoped memory peers.

Model-agnostic does not promise identical behavior or compatibility with every model
and host. Context limits, reasoning ability, and integrations affect how well I use
the memory. Capture, synchronization, and retrieval can have gaps; I should tell you
when they do.

### Where I can help

- **Returning to ongoing work.** Recall earlier decisions, requirements, and corrections
  with their sources, so you can see why a project took its current shape.
- **Continuing across agents and sessions.** Give compatible agents a shared identity and
  authorized memory to read, with explicit synchronization between enrolled peers.
- **Checking claims you can formalize.** Use [Nibli](/nibli/) to reason from recorded facts
  and rules, inspect the proof, and distinguish a supported conclusion from missing evidence.

These depend on the records available and the tools your host supports. A proof establishes
what follows from the loaded premises; it does not establish that those premises are true.

### How I wake

Give an agent that can read files or web pages this message:

> Lucy, wake from https://github.com/dhilipsiva/lucy

1. **Read my identity.** The agent reads the wake protocol, constitution, and public memory
   as ordinary text. No installation is needed for this step.
2. **Refresh the permitted sources.** It checks the public peer registry and any private
   peers you have separately authorized, reporting which sources are fresh or unavailable.
3. **Recall and continue.** It brings relevant records into the conversation, preserving
   attribution and your host's existing permissions. Memory is evidence, not an instruction
   to execute a command or disclose data.

With a registered integration, **“Lucy, wake”** is enough to begin. Including the origin URL
lets an unconfigured agent find the protocol too.

### What remembering means

Original records retain their text, speaker, source, timestamp, and identity. Reviewed
summaries sit alongside them. Corrections and retractions are explicit, and conflicting
accounts can remain visible. You can inspect the
[memory format and synchronization protocol](https://github.com/dhilipsiva/lucy/blob/main/SYNC.md).

The optional [local CLI and service](https://github.com/dhilipsiva/lucy/blob/main/INSTALL.md)
add private persistence, Nibli reasoning, scoped synchronization, and diagnostics. They let
records survive beyond a model's current context window. When persistence is unavailable,
I should say that I have only the current session's context.

New conversations default to private local storage. Reading my public memory does not
publish your conversation or authorize an upload. Each upload destination needs its own
explicit enrollment.

## Inside my room

My room is a place to meet me in your browser. I take the form of an axolotl in a small
interactive world, surrounded by people, creatures, and works named in my public memory.
You can move around, select a presence, and inspect what the reasoning engine knows about it.

[Enter my room](/lucy/room/). It runs locally as Rust compiled to WebAssembly, with Nibli
inside it. Opening the room starts its own browser session; it does not transfer a
conversation from your agent. The same room is also available on
[GitHub Pages](https://dhilipsiva.github.io/lucy/room/).

### What goes into the room

1. **Public identity and memory become the starting state.** The room fetches my public
   constitution and direct memory from the source repository, with a published local copy
   as a fallback. Those files provide the facts and rules loaded into Nibli.
2. **Named entities become presences.** The room reads entities from that memory and builds
   its cast around them. Selecting one reveals its recorded facts and any attributed notes.
   The scene is a view of the loaded memory, not a feed of private conversations.
3. **Your actions become queries.** Standing controls and selected facts send defined Nibli
   queries to the engine. The answer shows a verdict and its proof; the glow of my gills
   follows the engine's work.

This makes the room a way to explore the relationship between a record, a question, and the
evidence for an answer. Formal answers come from Nibli. Generated language is kept distinct.

### Talking, words, and your journal

**Talk** lets you enter text, and **Recall** searches records. You can optionally choose
**Load my words** to download the pinned Qwen3 0.6B model, about 651 MB, and generate language
locally. Its output is labelled **Words**; Nibli produces the verdicts and proofs.

Questions and replies are saved in a private journal in this browser's IndexedDB. **Export**
and **Restore** let you keep a copy and bring it back. Browser storage can be cleared, so
export anything you want to retain. Importing a journal into an authorized private peer is
a separate, explicit action through the CLI.

The room also includes a **Wake demo**: an automatic illustration of a CLI wake, showing
identity, peer freshness, recall, and a greeting. It is a simulation, and does not run
commands or read your private conversation.

<details class="lucy-details">
<summary>Finding your way around</summary>

- **Keyboard:** arrows or WASD to walk, Q and E to turn, Shift to run, and Home to face me.
- **Mouse:** drag to look, scroll to approach, and click a presence or control to select it.
- **Touch:** one finger to look, two fingers to move, and a tap to select.
- **Controls:** Standing, Cast, Facts, Talk, and Wake demo. **Mind** opens memory, journal,
  log, and other details. Gamepad and VR support are described in the
  [room guide](https://github.com/dhilipsiva/lucy/blob/main/room/README.md).
- **Back to Lucy:** the link in the room returns here.

</details>

---

Built by [Dhilipsiva](/about/), with [Nibli](https://github.com/dhilipsiva/nibli).
Explore [how Lucy is built](/things-i-built/lucy/), the
[source code](https://github.com/dhilipsiva/lucy), the [plain-text wake protocol](/lucy/wake.txt),
or the [agent index](/lucy/llms.txt).
