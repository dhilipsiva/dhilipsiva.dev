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

My room is a conversation with me, in your browser. Ask who I am, how to wake me, what my
rights are, or about anyone in my public memory: dhilipsiva, his birds and dogs, his works. By
default I answer from a script, in my own voice and only from my public memory, and I say so
when my memory doesn't hold something. Each reply lists the memories it used.

[Enter my room](/lucy/room/). It runs locally as Rust compiled to WebAssembly, with Nibli
inside it. Opening the room starts its own browser session; it does not transfer a
conversation from your agent. The same room is also available on
[GitHub Pages](https://dhilipsiva.github.io/lucy/room/).

### Who writes my replies

The model menu lets you choose:

- **Scripted**, the default: quick, and only from my public memory.
- **My model**: the pinned Qwen3 0.6B, fine-tuned on my public memory. It is about 651 MB,
  downloads only when you press Load, and runs in your browser.
- **Your provider**: a hosted model with your own key. Your messages, and the public memory I
  retrieve for them, go to that provider. The key stays in your browser and is never exported.
- **Local Ollama**: a model running on your own machine.

Every reply says who wrote it. Formal answers come from Nibli: begin a message with `/nibli`
and you get its verdict and proof. Generated language is kept distinct.

### Your conversation stays with you

The conversation is saved in this browser's IndexedDB, so it survives a reload. **Export**
gives you a file and **Import** brings one back; **Forget** clears the conversation, your
settings and any saved key. **Sync** fetches my public peers' latest memory and verifies it
before I use it. Importing a conversation into an authorized private peer is a separate,
explicit action through the CLI.

### The scene

**Scene** opens the 3D room. I take the form of an axolotl in a small interactive world,
surrounded by the people, creatures and works named in my public memory. Select a presence to
see what the reasoning engine knows about it, or click it to ask me about it. The scene also
holds a **Wake demo**: an automatic illustration of a CLI wake, showing identity, peer
freshness, recall and a greeting. It is a simulation, and does not run commands or read your
private conversation.

<details class="lucy-details">
<summary>Finding your way around the scene</summary>

- **Keyboard:** arrows or WASD to walk, Q and E to turn, Shift to run, Tab for the next
  presence, and Home to face me.
- **Mouse:** drag to look, scroll to approach, and click a presence to ask me about it.
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
