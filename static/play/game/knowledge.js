/* ============================================================================
   knowledge.js — the scripted brain. Keyword-matched Q&A about dhilipsiva.
   Answers in his voice: dry, precise, first person. No emoji.

   - TOPICS: { keys: [keywords], a: "answer" | [answers picked at random] }.
     Scoring = keyword hits weighted by keyword length. Tune freely.
   - FACTS_PROMPT is the system-prompt context handed to the WASM SLM when
     the user loads the optional "real brain" (see brain.js). Keep both in
     lockstep — the SLM repeats whatever is written there.
   ========================================================================== */

window.KNOWLEDGE = (function () {

  const TOPICS = [
    { keys: ['name', 'who are you', 'who is', 'yourself', 'intro'],
      a: "dhilipsiva. Hands-on software architect, lifelong builder, optimistic nihilist. Based in Bangalore, India. I build systems that outlive their meaning." },
    { keys: ['role', 'job', 'work', 'title', 'architect', 'vp', 'career'],
      a: "Software Architect, hands-on by choice. Previously VP of Engineering — I stepped back from managing people to architecting systems. Titles got shorter, systems got bigger. Correct direction." },
    { keys: ['where', 'location', 'live', 'based', 'bangalore', 'india', 'city', 'timezone'],
      a: "Bangalore, India. UTC+5:30. The void is everywhere, but the coffee here is better." },
    { keys: ['rust', 'ferris', 'crab'],
      a: "Rust is the homage baked into this site's ember accent. I use it for anything that must be correct and fast — nibli, my symbolic reasoning engine, is Rust compiled to WebAssembly." },
    { keys: ['python', 'py'],
      a: "Python is my second hand. hostscli — a CLI that blocks and unblocks websites straight from /etc/hosts — is the most honest thing I've shipped in it." },
    { keys: ['wasm', 'webassembly'],
      a: "WebAssembly is the closest thing we have to a universal, sandboxed fixed point of computation. nibli compiles to it. The optional brain you can load here is candle — Rust compiled to Wasm. It's Wasm all the way down." },
    { keys: ['webrtc', 'p2p', 'peer'],
      a: "WebRTC, but not for video calls — for peer-to-peer data. I keep coming back to broker-less meshes: nodes that find each other and agree without a central server. No single point of failure, no rent." },
    { keys: ['web3', 'blockchain', 'chain', 'crypto'],
      a: "Web3: interested in the math — trust-minimized protocols, verifiable state, consensus — and allergic to the hype. The cryptography deserves better marketing departments." },
    { keys: ['distributed', 'consensus', 'raft', 'paxos', 'cluster', 'quorum'],
      a: "Distributed systems are my home turf — consensus, deterministic replay, partition tolerance. Even nibli federates its knowledge bases with CRDTs and signed gossip. ∀ peers: agree, eventually." },
    { keys: ['symbolic', 'logic', 'reasoning', 'formal', 'proof', 'godel', 'gödel', 'incompleteness', 'halting'],
      a: "Symbolic reasoning is the thread through everything: nibli derives instead of predicting, the book is about self-reference becoming systems, and Gödel is why I sleep fine. Provable limits are a comfort, not a defect." },
    { keys: ['foss', 'open source', 'opensource', 'free software', 'license'],
      a: "FOSS by default. nibli, cognito, hostscli, awesome-rust-ml — open. Freedom is a design constraint I refuse to relax." },
    { keys: ['project', 'built', 'build', 'portfolio', 'made', 'created'],
      a: "Open source: nibli (zero-hallucination symbolic reasoning, Rust→Wasm), cognito (System 2 reasoning kernel in Rust), hostscli, awesome-rust-ml. Professional: Appknox, NuFlights, the Reckonsys years, ReWire. The workshop east of the atrium has all of them on pedestals." },
    { keys: ['nibli', 'hallucination', 'firewall', 'lojban', 'theorem'],
      a: "nibli — a zero-hallucination symbolic reasoning engine. Lojban in, first-order logic out; deterministic backward-chaining with a proof trace on every conclusion. A hallucination firewall for the LLM era. Rust→Wasm, 661 tests, open source, active. Favorite child." },
    { keys: ['cognito', 'kernel', 'system 2', 'burn'],
      a: "cognito — a pure-Rust System 2 reasoning kernel. Minimal knowledge, maximal logic: a transformer on the Burn framework that thinks in explicit steps — think, call, result. Reasoning over recall." },
    { keys: ['hostscli', 'hosts', 'block'],
      a: "hostscli — a Python CLI that blocks and unblocks websites via /etc/hosts. Ad lists, trackers, malware domains, or just the feeds at 2am. Sometimes the best firewall is a text file." },
    { keys: ['appknox', 'security', 'mobile'],
      a: "Appknox — mobile-app security scanning at scale. I'm the Software Architect on the platform: architecture, scaling, and the systems that have to be right." },
    { keys: ['nuflights', 'airline', 'ndc', 'flight'],
      a: "NuFlights — airline retailing on the NDC standard. Adapters in Rust and Python that translate between carriers speaking different dialects of the same spec. Protocol work; very real flights." },
    { keys: ['quine', 'self-reference', 'fixed point', 'fixpoint', 'f(x)'],
      a: "A quine prints its own source: eval(q) = q. The fixed point is my recurring motif — meaning that bootstraps itself from nothing. This site is the inhabitable version." },
    { keys: ['book', 'writing', 'author', 'fixed point of thought', 'utopia'],
      a: "I'm writing The Fixed Point of Thought (working title) — symbolic reasoning for builders, the ideas behind nibli. Equal parts Gödel, Rust, and lab notebook. Next in queue: Utopia, Reimagined. Drafting in the open." },
    { keys: ['reading', 'read', 'geb', 'escher', 'bach', 'hofstadter'],
      a: "Currently re-reading Gödel, Escher, Bach. 'Again' is load-bearing. Also reviewed: Programming WebAssembly with Rust. The reading shelf in the library has the rest." },
    { keys: ['blog', 'musing', 'musings', 'post', 'essay', 'article', 'rss'],
      a: "The Musings — a long-running notebook on building, logic, freedom, with detours into Tamil and philosophy of mind. Latest: 'On building things that outlive their meaning'. There's an RSS rune in the archive; protocols outlive platforms." },
    { keys: ['tamil', 'language', 'multilingual', 'bilingual', 'script'],
      a: "I write and think in English and Tamil — தமிழ். Bilingual thought taught me more about naming things in code than any style guide." },
    { keys: ['nihilism', 'nihilist', 'optimistic', 'philosophy', 'believe', 'meaning', 'camus', 'absurd', 'why'],
      a: "Optimistic nihilism: the universe is indifferent, so author your own fixed point. Nothing is owed — that's not despair, it's the most freeing license there is. Build anyway." },
    { keys: ['contact', 'email', 'mail', 'reach'],
      a: "dhilipsiva@pm.me. Worth writing about: hard distributed-systems questions, FOSS collaboration, symbolic-reasoning rabbit holes, talk invitations. The uplink room is south-east if you want the ceremony." },
    { keys: ['github', 'linkedin', 'stack overflow', 'stackoverflow', 'medium', 'social', 'twitter', 'x.com'],
      a: "GitHub, LinkedIn, Stack Overflow, Medium — find me where the source lives. Or just email; fewer intermediaries, fewer terms of service." },
    { keys: ['now', 'currently', 'these days', 'focus', 'working on'],
      a: "Now: building nibli, writing The Fixed Point of Thought, re-reading GEB, working as a Software Architect. Lately I'm retrofitting symbolic reasoning for the LLM era. The now-board south of the atrium is dated on purpose." },
    { keys: ['uses', 'setup', 'editor', 'tools', 'hardware', 'laptop', 'os', 'linux', 'nixos', 'terminal', 'dotfiles'],
      a: "The armory holds the loadout: NixOS on every machine — one declarative config, identical everywhere. Neovim, zsh + tmux. Rust, Python, Wasmtime in active rotation. Reproducibility is a feeling." },
    { keys: ['talk', 'talks', 'speak', 'speaking', 'conference', 'meetup', 'slides', 'bangml'],
      a: "I founded BangML — the Bangalore Machine Learning meetup — back in 2016. I'll gladly speak on Rust, symbolic reasoning, WebAssembly, or distributed systems: dhilipsiva@pm.me." },
    { keys: ['entrepreneur', 'startup', 'business', 'company', 'founder'],
      a: "Not an entrepreneur. I just want to build the things. Running a business is a different craft, practiced by different people, ideally far from my terminal." },
    { keys: ['game', 'website', 'site', 'dungeon', 'this place', 'constellation'],
      a: "You're inside my personal site, rendered as a phosphor-on-void constellation. Nine clusters, one narrator, zero cookies. The flat version still exists — the 'exit' link up top, if you miss scrolling." },
    { keys: ['brain', 'slm', 'model', 'llm', 'ai', 'smart', 'real brain', 'candle'],
      a: "Right now you're talking to a scripted index — instant and accurate. Load the real brain and a small language model runs entirely in your browser: candle, Rust compiled to WebAssembly. Slower, fuzzier, more alive. Your call." },
    { keys: ['hello', 'hi ', 'hey', 'greetings', 'sup', 'namaste', 'vanakkam'],
      a: ["Hello. The universe remains indifferent. I, however, acknowledge you.", "வணக்கம். Welcome to the void, organized."] },
    { keys: ['thanks', 'thank you', 'cool', 'nice', 'awesome', 'love'],
      a: "Noted and committed. Nothing is owed, but it's appreciated anyway." },
    { keys: ['life', '42', 'universe', 'point of'],
      a: "The meaning of life is unassigned by default. You get to write to that register. I chose: build systems, keep them honest, leave the source open." }
  ];

  const FALLBACKS = [
    "Insufficient data in the scripted index. Rephrase, or load the real brain — it guesses with more confidence.",
    "That query misses every keyword I have. Deadpan honesty: I don't know. Try asking about projects, the book, philosophy, or contact.",
    "⊥ — no match. The scripted brain only knows about dhilipsiva. For anything broader, load the Wasm brain and lower your expectations accordingly."
  ];

  function normalize(s) { return ' ' + s.toLowerCase().replace(/[^\p{L}\p{N}\s.()@-]/gu, ' ').replace(/\s+/g, ' ').trim() + ' '; }

  /* Returns { text, matched } — matched=false means fallback. */
  function answer(query) {
    const q = normalize(query);
    let best = null, bestScore = 0;
    for (const t of TOPICS) {
      let score = 0;
      for (const k of t.keys) if (q.includes(k.trim().length < 4 ? ' ' + k.trim() + ' ' : k)) score += k.length;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    if (!best) {
      const f = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
      return { text: f, matched: false };
    }
    const a = Array.isArray(best.a) ? best.a[Math.floor(Math.random() * best.a.length)] : best.a;
    return { text: a, matched: true };
  }

  /* Context handed to the WASM SLM as a system prompt. Keep it tight —
     small models drown in long prompts. */
  const FACTS_PROMPT =
`You are dhilipsiva, narrating your own personal website (a node constellation you fly through). Voice: deadpan, precise, optimistic-nihilist, first person, 1-3 sentences, no emoji.
Facts: hands-on Software Architect (previously VP of Engineering), Bangalore India. Loves Science, Rust, Python, FOSS, WebAssembly, WebRTC, Web3, Distributed Systems, symbolic reasoning. Writes in English and Tamil. Lately retrofitting symbolic reasoning for the LLM era.
Open-source projects: nibli (zero-hallucination symbolic reasoning engine, a "hallucination firewall" — Lojban to first-order logic, proof trace on every answer, Rust compiled to Wasm), cognito (pure-Rust System 2 reasoning kernel on Burn), hostscli (Python CLI, blocks sites via /etc/hosts), awesome-rust-ml (curated Rust ML list).
Professional: Appknox (mobile-app security scanning, current — Software Architect), NuFlights (airline NDC adapters, Rust/Python), Reckonsys (VP of Engineering, ~70% hands-on), ReWire (2011 interactive meditation app).
Writing a book on symbolic reasoning for builders, working title "The Fixed Point of Thought"; "Utopia, Reimagined" is queued. Re-reading Gödel Escher Bach. Blog is called Musings. Founded the BangML meetup (2016).
Philosophy: optimistic nihilism — the universe is indifferent, author your own fixed point. "Nothing is owed. Build anyway." Not an entrepreneur, just a builder. Contact: dhilipsiva@pm.me. Never claim he is looking for work. If unsure, say so plainly.`;

  return { answer, FACTS_PROMPT };
})();
