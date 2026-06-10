/* ============================================================================
   world.js — the constellation: rooms, corridors, entities, and ALL narrative
   copy. QUINE voice: deadpan, precise, optimistic-nihilist. No emoji, ever.

   - Map is generated from ROOMS + CORRIDORS (carved at runtime by engine.js).
   - Every line of narrator copy lives HERE. Edit text, not engine code.
   - Entity = { x, y, glyph, color, name, lines[] }. lines[] are advanced
     with [space]. Keep lines < ~220 chars each so the bubble breathes.
   ========================================================================== */

window.WORLD = (function () {

  const MAP_W = 86, MAP_H = 52;

  /* ── Rooms ───────────────────────────────────────────────────────────── */
  // land = where fast-travel drops you. enter[] = first-visit narration.
  const ROOMS = [
    {
      id: 'atrium', name: 'the atrium', x: 34, y: 20, w: 18, h: 12, land: [43, 26],
      enter: [
        "Hi — I'm dhilipsiva. This is my site; it flies. Tap W A S D or the arrows to glide between nodes — the amber chips show exactly where each key goes.",
        "Space inspects whatever you're on. Shift+tap warps between clusters. Ctrl lets you ask me anything. Press ? if you forget.",
        "Visit every node in a cluster and it reaches quorum. Light up all nine and the network finds its fixed point. Nothing is owed. Fly anyway."
      ]
    },
    {
      id: 'built', name: 'the workshop // things i built', x: 60, y: 18, w: 22, h: 16, land: [62, 25],
      enter: [
        "The workshop. Everything on a pedestal here was built to outlive its meaning. Some of it also outlived its funding.",
        "North row: open source, mine. South row: professional, built for employers. Both count. Inspect anything."
      ]
    },
    {
      id: 'books', name: 'the library // books', x: 36, y: 4, w: 16, h: 10, land: [43, 11],
      enter: ["The library. One book being written, many being read. The ratio is intentional."]
    },
    {
      id: 'musings', name: 'the archive // musings', x: 10, y: 4, w: 18, h: 10, land: [25, 9],
      enter: ["The archive. Long-running thoughts, version-controlled. The universe doesn't read them. I write them anyway."]
    },
    {
      id: 'talks', name: 'the stage // talks', x: 62, y: 4, w: 16, h: 9, land: [64, 9],
      enter: ["The stage. Occasionally I say words at meetups and conferences. The slides survive longer than the applause."]
    },
    {
      id: 'about', name: 'the study // about', x: 6, y: 19, w: 20, h: 13, land: [23, 25],
      enter: ["The study. This is where I keep the 'who'. Short version: a builder, not an entrepreneur. The long version is on the walls."]
    },
    {
      id: 'now', name: 'the now-board', x: 36, y: 38, w: 14, h: 9, land: [43, 40],
      enter: ["The now-board. A dated snapshot of current focus, in the spirit of /now pages. Accurate as of last commit."]
    },
    {
      id: 'uses', name: 'the armory // uses', x: 10, y: 38, w: 18, h: 10, land: [25, 42],
      enter: ["The armory. Tools, hardware, environment. An engineer's loadout says more than a bio."]
    },
    {
      id: 'contact', name: 'the uplink // contact', x: 60, y: 39, w: 18, h: 9, land: [62, 42],
      enter: ["The uplink. One email address, no contact-form theater. The void is indifferent; I am not. Write to me."]
    }
  ];

  /* ── Corridors (1-wide carved lines) ─────────────────────────────────── */
  const CORRIDORS = [
    { h: true,  y: 25, x1: 24, x2: 36 },  // about ↔ atrium
    { h: true,  y: 25, x1: 50, x2: 62 },  // atrium ↔ built
    { h: false, x: 43, y1: 12, y2: 21 },  // books ↔ atrium
    { h: false, x: 43, y1: 31, y2: 39 },  // atrium ↔ now
    { h: true,  y: 9,  x1: 26, x2: 38 },  // musings ↔ books
    { h: true,  y: 9,  x1: 50, x2: 63 },  // books ↔ talks
    { h: false, x: 16, y1: 12, y2: 20 },  // musings ↔ about
    { h: false, x: 70, y1: 11, y2: 19 },  // talks ↔ built
    { h: false, x: 16, y1: 30, y2: 39 },  // about ↔ uses
    { h: false, x: 70, y1: 33, y2: 40 },  // built ↔ contact
    { h: true,  y: 42, x1: 26, x2: 38 },  // uses ↔ now
    { h: true,  y: 42, x1: 48, x2: 61 }   // now ↔ contact
  ];

  /* ── Entities ────────────────────────────────────────────────────────── */
  // color keys map to DS tokens in engine.js: ember | phosphor | quanta | paper | sky | amber
  const ENTITIES = [

    /* atrium */
    {
      x: 40, y: 23, glyph: '▣', color: 'phosphor', name: 'whoami terminal',
      lines: [
        "~ ❯ whoami --verbose",
        "name = \"dhilipsiva\" · role = Software Architect · loc = Bangalore, India · focus = \"symbolic reasoning, retrofit for LLMs\"",
        "An Optimistic Nihilist who loves Science, Rust, Python, FOSS, WebAssembly, WebRTC, Web3, Distributed Systems, and symbolic reasoning.",
        "~ ❯ nibli verify \"the model's answer\"  ⊢ derive ⟶ proof, not prediction · ∴ no hallucination · 38ms ✓"
      ]
    },
    {
      x: 46, y: 28, glyph: '∴', color: 'ember', name: 'the fixed point',
      lines: [
        "f(x) = x. A quine is a program that prints its own source. Consensus is a cluster agreeing on its own state.",
        "Meaning that bootstraps itself from nothing. The universe won't assign you one — that's not despair, it's a free license. This whole site is built on that."
      ]
    },
    {
      x: 38, y: 29, glyph: '?', color: 'paper', name: 'a sign nailed to the floor',
      lines: [
        "CONTROLS — wasd / arrows: tap to glide · shift+tap: warp to the next cluster · space: inspect / advance · ctrl: ask me anything · esc: close things.",
        "The buttons up top teleport between clusters. Fast travel for the impatient. No judgment."
      ]
    },

    /* workshop — open-source row */
    {
      x: 64, y: 22, glyph: '∴', color: 'phosphor', name: 'nibli — pedestal', badge: 'active',
      lines: [
        "nibli. A zero-hallucination symbolic reasoning engine — a hallucination firewall for the LLM era. Lojban in, first-order logic out.",
        "Every answer is derived, never guessed: deterministic backward-chaining with a proof trace on every conclusion. Rust, compiled to WebAssembly. 661 tests. Open source, active.",
        "My favorite child, which I'd never admit to the others."
      ]
    },
    {
      x: 69, y: 22, glyph: '∇', color: 'phosphor', name: 'cognito — pedestal', badge: 'active',
      lines: [
        "cognito. A pure-Rust System 2 reasoning kernel — minimal knowledge, maximal logic.",
        "A transformer built on the Burn framework that thinks in explicit steps: think, call, result. Reasoning over recall. Open source, active."
      ]
    },
    {
      x: 74, y: 22, glyph: '⊘', color: 'phosphor', name: 'hostscli — pedestal', badge: 'shipped',
      lines: [
        "hostscli. A Python CLI that blocks and unblocks websites straight from /etc/hosts — ad lists, trackers, malware domains, or just the feeds at 2am.",
        "Simple, extendable, shipped. Sometimes the best firewall is a text file."
      ]
    },
    {
      x: 78, y: 22, glyph: '≡', color: 'phosphor', name: 'awesome-rust-ml — pedestal', badge: 'curated',
      lines: [
        "awesome-rust-ml. A curated map of the Rust machine-learning ecosystem — frameworks, kernels, runtimes.",
        "Curation is also building: someone has to keep the index honest. Open, maintained."
      ]
    },

    /* workshop — professional row */
    {
      x: 64, y: 29, glyph: '⊢', color: 'paper', name: 'Appknox — pedestal', badge: 'current',
      lines: [
        "Appknox. Mobile-app security scanning at scale — static, dynamic, and API analysis.",
        "Software Architect on the platform: architecture, scaling, and the systems that have to be right. Closed source; the pedestal is all you get."
      ]
    },
    {
      x: 69, y: 29, glyph: '⇄', color: 'paper', name: 'NuFlights — pedestal', badge: 'professional',
      lines: [
        "NuFlights. Airline retailing on the NDC standard — adapters that translate between carriers speaking different dialects of the same spec.",
        "Rust and Python doing protocol work. Closed source, very real flights."
      ]
    },
    {
      x: 74, y: 29, glyph: '⎇', color: 'paper', name: 'the Reckonsys years — pedestal', badge: 'professional',
      lines: [
        "The Reckonsys years. VP of Engineering, ~70% hands-on by choice. Python and Rust microservices for startups, teams of five to fifteen.",
        "The title said management; the commit history said otherwise."
      ]
    },
    {
      x: 78, y: 29, glyph: '◐', color: 'quanta', name: 'ReWire — pedestal', badge: 'archived',
      lines: [
        "ReWire, 2011. One of the first interactive meditation apps — train focus and presence using your own music, on an iPhone.",
        "Built before 'mindfulness app' was a category. Archived, fondly. Even dead systems leave fixed points."
      ]
    },

    /* library */
    {
      x: 41, y: 8, glyph: '▤', color: 'ember', name: 'manuscript — The Fixed Point of Thought', badge: 'in progress',
      lines: [
        "The Fixed Point of Thought (working title). A book on symbolic reasoning for builders — the ideas behind nibli: how logic, recursion, and self-reference become real, running systems.",
        "Equal parts Gödel, Rust, and lab notebook. Drafting in the open. Status: in progress, which is a state I respect more than 'done'.",
        "Next in the queue: Utopia, Reimagined — optimistic nihilism applied to coordination, economics, and freedom."
      ]
    },
    {
      x: 47, y: 10, glyph: '❡', color: 'paper', name: 'the reading shelf',
      lines: [
        "Currently re-reading Gödel, Escher, Bach. 'Again' is doing a lot of work in that sentence.",
        "Reviewed: Programming WebAssembly with Rust — solid foundations, though the ecosystem has since moved. Gödel, Escher, Bach — the strange loop that rewired me.",
        "The shelf accepts new spines faster than I finish them. A classic unbounded queue."
      ]
    },

    /* archive — musings */
    {
      x: 14, y: 7, glyph: '¶', color: 'paper', name: 'musing — 2026-05-28',
      lines: [
        "On building things that outlive their meaning. 2026-05-28.",
        "The universe doesn't owe your software a reason to exist. That's not despair — it's the most freeing license a builder can be handed. A note on authoring your own fixed point."
      ]
    },
    {
      x: 19, y: 9, glyph: '¶', color: 'paper', name: 'musing — 2026-04-11',
      lines: [
        "Gödel, the halting problem, and why I sleep fine. 2026-04-11.",
        "Incompleteness is not a bug report against reality. What undecidability actually means for the systems we build — and the strange comfort in provable limits."
      ]
    },
    {
      x: 24, y: 7, glyph: '¶', color: 'paper', name: 'musing — 2026-03-02',
      lines: [
        "தமிழில் நிரலாக்கம் — thinking in two scripts. 2026-03-02.",
        "Notes on writing, reading, and reasoning across English and Tamil — and what bilingual thought taught me about naming things in code."
      ]
    },
    {
      x: 14, y: 11, glyph: '⌁', color: 'amber', name: 'RSS rune',
      lines: ["An RSS feed. Yes, still. Protocols outlive platforms. Subscribe and the musings come to you, no algorithm in between."]
    },

    /* stage — talks */
    {
      x: 69, y: 8, glyph: '⊳', color: 'sky', name: 'the podium',
      lines: [
        "Talks and meetups get logged here — title, venue, slides, recording.",
        "2016 — founded BangML, the Bangalore Machine Learning meetup. Talks, study groups, and a great deal of whiteboarding.",
        "Topics I'll gladly speak on: Rust, symbolic reasoning, WebAssembly, distributed systems. The uplink is south-east of here."
      ]
    },

    /* study — about */
    {
      x: 12, y: 23, glyph: '◉', color: 'ember', name: 'portrait plaque',
      lines: [
        "Hands-on software architect, lifelong builder. Bangalore, India. Previously VP of Engineering; deliberately stepped back to architecture.",
        "I care about correctness, freedom, and code that still makes sense in a decade. Not an entrepreneur — I just want to build the things.",
        "Languages: Rust, Python, Wasm… and Tamil. I think in two scripts. It helps with naming."
      ]
    },
    {
      x: 19, y: 27, glyph: '✦', color: 'quanta', name: 'the obelisk — optimistic nihilism',
      lines: [
        "Optimistic nihilism, the operating thesis: the universe is indifferent, so author your own fixed point.",
        "Nothing is owed. Build anyway. One must imagine the compiler happy."
      ]
    },
    {
      x: 12, y: 28, glyph: '⟲', color: 'paper', name: 'the timeline',
      lines: [
        "Timeline, compressed: engineer → VP of Engineering → Software Architect. The title got shorter as the systems got bigger. That's the correct direction.",
        "2011 — ReWire, an interactive meditation app. 2019–2022 — VP of Engineering at Reckonsys, ~70% hands-on. 2022–now — Software Architect at Appknox.",
        "Lately the thread is symbolic reasoning: building nibli, and writing the book about it."
      ]
    },

    /* now-board */
    {
      x: 40, y: 41, glyph: '◷', color: 'phosphor', name: 'the now-board', badge: 'updated 2026-06',
      lines: [
        "NOW — building: nibli. writing: The Fixed Point of Thought. reading: Gödel, Escher, Bach (again). role: Software Architect.",
        "This board is dated on purpose. A 'now' that never changes is just an 'about' with worse version control."
      ]
    },

    /* armory — uses */
    {
      x: 15, y: 41, glyph: '⌨', color: 'paper', name: 'the rig',
      lines: [
        "hardware / OS / editor / terminal: NixOS everywhere — laptops, desktops, VMs, one declarative config. Neovim. zsh + tmux.",
        "If a machine dies, its replacement is identical by Friday. Reproducibility is a feeling."
      ]
    },
    {
      x: 21, y: 44, glyph: '⚙', color: 'paper', name: 'the toolchain',
      lines: [
        "Languages and tools in active rotation: Rust, Python, WebAssembly (Wasmtime), WebRTC, distributed systems, symbolic reasoning.",
        "FOSS by default. Rent-free infrastructure where possible. The toolchain is a worldview with a package manager."
      ]
    },

    /* uplink — contact */
    {
      x: 66, y: 43, glyph: '✉', color: 'ember', name: 'the uplink terminal',
      lines: [
        "dhilipsiva@pm.me — the canonical address. Bangalore, India, UTC+5:30.",
        "Good reasons to write: hard distributed-systems questions, FOSS collaboration, symbolic-reasoning rabbit holes, talk invitations, or telling me I'm wrong with evidence."
      ]
    },
    {
      x: 72, y: 43, glyph: '⌬', color: 'sky', name: 'the social array',
      lines: [
        "Elsewhere: GitHub, LinkedIn, Stack Overflow, Medium. Find me where the source lives.",
        "Or skip the platforms entirely and email. Fewer intermediaries, fewer terms of service."
      ]
    }
  ];

  /* ── Idle quips (after ~25s of stillness; rotate, never repeat twice) ── */
  const IDLE = [
    "You've stopped moving. Statistically, everything does.",
    "The cursor blinks whether or not anyone watches. I find that comforting.",
    "Standing still is a valid strategy. The heat death is patient.",
    "Press ctrl and ask me something. Worst case, the answer is true.",
    "Somewhere, nibli's 661 tests are passing. The universe remains indifferent to this. I don't."
  ];

  /* ── Consensus mechanic copy ────────────────────────────────── */
  // Spoken once when every node in a cluster has been visited.
  const QUORUM = {
    atrium:  "The atrium acknowledges you. One cluster at quorum. The rest of the network is still asleep.",
    built:   "Quorum on the workshop — every pedestal inspected, every ack received. They rarely get this much attention.",
    books:   "The library is in sync. Both shelves acknowledged. Somewhere, the manuscript gained a sentence.",
    musings: "Archive at quorum. You read the headlines, at least. That already puts you above the median visitor.",
    talks:   "The stage acknowledges. One podium, fully visited. Low fan-in, honest latency.",
    about:   "The study is in sync. You now know the 'who'. The 'why' is in the obelisk, in case you skipped it.",
    now:     "Now-board acknowledged. A single node, dated, truthful. Consensus was never in doubt.",
    uses:    "Armory at quorum. Inventory acknowledged, reproducible by design. That ratio is very engineering.",
    contact: "Uplink at quorum. You know where to find me. The void is indifferent; my inbox is not."
  };

  // Spoken once when ALL clusters reach quorum.
  const FIXED_POINT = [
    "∀ clusters: acknowledged. 9/9. The network just reached its fixed point — eval(site) = site.",
    "There is nothing left to unlock, which is the point. Nothing was owed, and you flew it all anyway. One must imagine the visitor happy."
  ];

  /* ── Help overlay copy ───────────────────────────────────────────────── */
  const HELP = {
    title: 'dhilipsiva.com — a site you fly through',
    keys: [
      ['w a s d', 'tap to glide to the next node (arrows work too)'],
      ['shift + wasd', 'warp to the next cluster'],
      ['space', 'inspect a node · advance dialogue'],
      ['ctrl', 'ask me anything'],
      ['esc', 'close panels']
    ],
    footer: 'Nothing is owed. Fly anyway.'
  };

  return { MAP_W, MAP_H, ROOMS, CORRIDORS, ENTITIES, IDLE, HELP, QUORUM, FIXED_POINT };
})();
