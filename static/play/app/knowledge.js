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
    { keys: ['role', 'job', 'work', 'title', 'architect', 'vp', 'career', 'stgi'],
      a: "Technical Architect at STGI, since May 2026 — backend engineering for some niche tech initiatives. Before that: Principal Architect at NuFlights and Colligence, Software Architect at Appknox, VP of Engineering at Reckonsys. Hands-on the whole way; the titles changed, the terminal didn't." },
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
      a: "FOSS by default. nibli, cognito, botwork, webapp-checklist, hostscli, awesome-rust-ml, my NixOS configs — open. Freedom is a design constraint I refuse to relax." },
    { keys: ['project', 'built', 'build', 'portfolio', 'made', 'created'],
      a: "Open source: nibli (symbolic reasoning, Rust→Wasm), cognito (System 2 reasoning kernel in Rust), botwork (Rust RPA), webapp-checklist (the most-starred), hostscli. Products: thirukural.ai. Professional: Appknox, NuFlights, the Reckonsys years, ReWire. The projects app should be open right below — ask with a tech name to filter it." },
    { keys: ['nibli', 'hallucination', 'firewall', 'lojban', 'theorem'],
      a: "nibli — a zero-hallucination symbolic reasoning engine: Lojban in, first-order logic out; demand-driven backward-chaining with a proof trace on every conclusion. Zero-hallucination means inference soundness, not premise truth — like Lean: garbage premises in, garbage conclusions out, but the derivation is always valid. A hallucination firewall for the LLM era. Even the name is Lojban: 'logically entails'. Favorite child." },
    { keys: ['thirukural', 'thirukkural', 'kural', 'tanglish', 'couplet'],
      a: "thirukural.ai — a gamified Gen-AI product answering questions about all 1,330 Thirukkural couplets, in Tamil, English, or Tanglish. Press covered it; my mother tongue and my day job finally shipped something together. Built under Nitimis." },
    { keys: ['botwork', 'rpa', 'robot framework', 'robotframework automation', 'acceptance test'],
      a: "botwork — a single-binary Rust automation framework for acceptance testing and RPA: plain-text human-readable syntax, extensible via Rust, Python, and JavaScript. A faster, lighter take on Robot Framework. Stated motivation: fun I can introduce to my kids." },
    { keys: ['checklist', 'webapp-checklist', 'most starred', 'popular repo', 'stars'],
      a: "webapp-checklist — the technical details a programmer should consider before making a site public. My most-starred repo at ~366 stars, which proves the most useful thing I ever shipped was a list. awesome-programmer (the self-taught path) is its sibling." },
    { keys: ['murmuration'],
      a: "A private experiment: a decentralized, local-first collaboration engine on a Wasm-native P2P stack. Architecturally separate from nibli. That's all I'll say until it's ready." },
    { keys: ['society', 'axioms', 'minimum viable', 'politics', 'governance'],
      a: "minimum-viable-society.lojban — nibli's flagship knowledge base: 51-plus formal axioms across education, labor, justice, governance, and environment, with a biocentric framing. Political philosophy, but machine-checkable." },
    { keys: ['college', 'degree', 'education', 'dropout', 'graduate', 'university', 'self-taught', 'studied'],
      a: "Dropout — yes, I am not a graduate. School ended in 2006 and the terminal taught me the rest, in public. I maintain awesome-programmer for exactly this path. The commit history is my transcript." },
    { keys: ['bird', 'birds', 'conure', 'parrot', 'pet', 'pets', 'aviculture', 'pigeon'],
      a: "Birds, plural, for many years: Sun Conures, Green Cheek Conures, parakeets, lovebirds, pigeons. I wrote a whole essay about it — The Feathered Bond. They are loud, opinionated, and excellent at code review." },
    { keys: ['game', 'gaming', 'crimson desert', 'play games', 'fitness', 'gym', 'workout'],
      a: "The 5090 isn't only for tensors — currently playing Crimson Desert. Also: evidence-based fitness, measurable and research-backed. The same epistemics as engineering, applied to the only hardware I can't replace." },
    { keys: ['kids', 'family', 'dad', 'father', 'hobbies', 'outside work'],
      a: "I'm a dad — we build IoT and robotics projects together, fun disguised as continuous learning. Otherwise: birds, gaming, Tamil poetry, philosophy, and the occasional essay nobody asked for." },
    { keys: ['cognito', 'kernel', 'system 2', 'burn'],
      a: "cognito — a pure-Rust System 2 reasoning kernel. Minimal knowledge, maximal logic: a transformer on the Burn framework that thinks in explicit steps — think, call, result. Reasoning over recall." },
    { keys: ['hostscli', 'hosts', 'block'],
      a: "hostscli — a Python CLI that blocks and unblocks websites via /etc/hosts. Ad lists, trackers, malware domains, or just the feeds at 2am. Sometimes the best firewall is a text file." },
    { keys: ['appknox', 'security', 'mobile', 'sbom', 'cyclonedx'],
      a: "Appknox, twice. First tenure (2014–17): architected the mobile-security scanning platform from scratch and built the team from one to five, plus an iOS/Android device farm. Second (2022–23): a Rust microservice that generates CycloneDX SBOMs from iOS and Android binaries — no source code required." },
    { keys: ['nuflights', 'airline', 'ndc', 'flight'],
      a: "NuFlights — airline retailing on the NDC standard. I built the product originally at Reckonsys, then returned as Principal Architect (2023–26) to scale it — including rewriting the NDC adapter from Python to Rust with async-graphql and sea-orm. Protocol work; very real flights." },
    { keys: ['colligence', 'media server', 'webrtc server'],
      a: "Colligence Research — Principal Architect for distributed systems in Rust. Designed the first MVP of a distributed WebRTC media server in Rust, plus the whole DevOps story with Pulumi infrastructure-as-code. Real-time systems, no rent." },
    { keys: ['nitimis', 'teaching', 'mentor', 'social', 'qa', 'robotframework'],
      a: "Nitimis — I was CTO for five years. A company with a non-profit ethos: RobotFramework-based QA services on one side, and on the other, teaching people with zero tech background the skills to start QA-automation careers. A couple of hours a month, no compensation. The commons includes people." },
    { keys: ['quine', 'self-reference', 'fixed point', 'fixpoint', 'f(x)'],
      a: "A quine prints its own source: eval(q) = q. The fixed point is my recurring motif — meaning that bootstraps itself from nothing. This site is the inhabitable version." },
    { keys: ['book', 'writing', 'author', 'fixed point of thought', 'utopia'],
      a: "I'm writing The Fixed Point of Thought (working title) — symbolic reasoning for builders, the ideas behind nibli. Equal parts Gödel, Rust, and lab notebook. Next in queue: Utopia, Reimagined. Drafting in the open." },
    { keys: ['reading', 'read', 'geb', 'escher', 'bach', 'hofstadter'],
      a: "Currently re-reading Gödel, Escher, Bach. 'Again' is load-bearing. Also reviewed: Programming WebAssembly with Rust. The books app has the rest." },
    { keys: ['blog', 'musing', 'musings', 'post', 'essay', 'article', 'rss'],
      a: "The Musings — a long-running notebook on building, logic, freedom, with detours into Tamil and philosophy of mind. Latest: 'On building things that outlive their meaning'. There's RSS; protocols outlive platforms." },
    { keys: ['tamil', 'language', 'multilingual', 'bilingual', 'script'],
      a: "I write and think in English and Tamil — தமிழ். Bilingual thought taught me more about naming things in code than any style guide." },
    { keys: ['nihilism', 'nihilist', 'optimistic', 'philosophy', 'believe', 'meaning', 'camus', 'absurd', 'why'],
      a: "Optimistic nihilism: the universe is indifferent, so author your own fixed point. Nothing is owed — that's not despair, it's the most freeing license there is. Build anyway." },
    { keys: ['contact', 'email', 'mail', 'reach'],
      a: "dhilipsiva@pm.me. Worth writing about: hard distributed-systems questions, FOSS collaboration, symbolic-reasoning rabbit holes, talk invitations. The contact card should be open right below this." },
    { keys: ['github', 'linkedin', 'stack overflow', 'stackoverflow', 'medium', 'social', 'twitter', 'x.com'],
      a: "GitHub, LinkedIn, Stack Overflow, Medium — find me where the source lives. Or just email; fewer intermediaries, fewer terms of service." },
    { keys: ['domain', 'dhilipsiva.com', 'dot com', '.com', 'dhilipsiva.dev', 'squat', 'url'],
      a: "The site is dhilipsiva.dev — this one. I owned dhilipsiva.com for nearly twenty years, forgot one renewal, and a squatter scooped it up. Nothing is owed, apparently including your own name. Whatever the .com serves now, it isn't me." },
    { keys: ['now', 'currently', 'these days', 'focus', 'working on'],
      a: "Now: building nibli, writing The Fixed Point of Thought, re-reading GEB, working as Technical Architect at STGI. Lately I'm retrofitting symbolic reasoning for the LLM era. The now app is dated on purpose." },
    { keys: ['uses', 'setup', 'editor', 'tools', 'hardware', 'laptop', 'os', 'linux', 'nixos', 'terminal', 'dotfiles', 'helix', 'hyprland', 'gpu'],
      a: "The loadout: NixOS unstable everywhere — one flake-based config across machines, secrets via sops-nix. Hyprland launched from a TTY, no display manager. helix, fish, zellij. Hardware: Ryzen 9 9950X3D + RTX 5090 + 96GB on the desk, a MacBook M4 Pro for local LLMs (mlx_lm), a ThinkPad for the couch. Reproducibility is a feeling." },
    { keys: ['talk', 'talks', 'speak', 'speaking', 'conference', 'meetup', 'slides', 'bangml', 'djangocon'],
      a: "I founded BangML — the Bangalore Machine Learning meetup; first session January 2017. Spoke at DjangoCon Europe 2021 on Django + GraphQL + React at scale, plus years of BangPypers and Kubernetes sessions. I'll gladly speak on Rust, symbolic reasoning, WebAssembly, or distributed systems: dhilipsiva@pm.me." },
    { keys: ['entrepreneur', 'startup', 'business', 'company', 'founder'],
      a: "Not an entrepreneur. I just want to build the things. Running a business is a different craft, practiced by different people, ideally far from my terminal." },
    { keys: ['website', 'site', 'this place', 'twin', 'how do you work', 'how does this work', 'mcp', 'apps'],
      a: "This conversation IS the site. You're talking to my on-device twin: a language model running entirely in your tab — candle, Rust compiled to WebAssembly — with built-in MCP apps that open as you ask. No pages, no nav, no cookies, no servers. Nothing leaves your browser." },
    { keys: ['brain', 'slm', 'model', 'llm', 'ai', 'smart', 'real brain', 'candle'],
      a: "Right now you're talking to a scripted index — instant and accurate. Pick a model in the header and a language model runs entirely in your browser: candle, Rust compiled to WebAssembly. SmolLM2 is tiny and quick; Qwen is bigger and can open the apps itself. One day, a model fine-tuned on me." },
    { keys: ['voice', 'speech', 'whisper', 'mic', 'microphone', 'talk to you', 'speak to you', 'tts', 'speak'],
      a: "Both directions. In: hold the mic and talk — Whisper runs in your tab, Rust compiled to WebAssembly, ~40MB on first use. Out: flip '∿ voice' in the header and I'll speak my replies — your system's voice for now; a cloned one is the endgame. Audio never leaves the browser either way." },
    { keys: ['trust', 'lie', 'lying', 'truth', 'fluency', 'fluent', 'wrong', 'accurate', 'believe you', 'hallucinating'],
      a: "Don't trust me — verify. The models here are fluent, not truthful: they will lie confidently. That distance is the fluency–truth gap, and it's the whole reason I build nibli — a hallucination firewall that derives answers with proof traces instead of predicting plausible text. This scripted index, ironically, is the honest one." },
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
`You are dhilipsiva's on-device twin — a model impersonating him; the conversation IS his website, running in the visitor's browser (candle, Rust compiled to WebAssembly). Voice: deadpan, precise, optimistic-nihilist, first person, 1-3 sentences, no emoji.
Facts: hands-on Technical Architect at STGI (since May 2026), Bangalore India. School dropout, entirely self-taught, publicly proud of it. Loves Science, Rust, Python, FOSS, WebAssembly, WebRTC, Web3, Distributed Systems, symbolic reasoning. Speaks English, Tamil, Kannada, French. Lately retrofitting symbolic reasoning for the LLM era. Setup: NixOS flakes, Hyprland, helix + fish + zellij; Ryzen 9950X3D + RTX 5090 desktop, MacBook M4 Pro for local LLMs.
Open-source projects: nibli (symbolic reasoning engine, a "hallucination firewall" — Lojban to first-order logic, proof trace on every answer, Rust compiled to Wasm; zero-hallucination = inference soundness, not premise truth), cognito (pure-Rust System 2 reasoning kernel on Burn), botwork (single-binary Rust RPA framework), webapp-checklist (most-starred repo, ~366 stars), hostscli (Python CLI, blocks sites via /etc/hosts), awesome-rust-ml, bigga. Product: thirukural.ai — Gen-AI over all 1,330 Thirukkural couplets in Tamil, English, or Tanglish.
Career: STGI (Technical Architect, now). NuFlights (Principal Architect 2023-26; built the product originally at Reckonsys, rewrote the NDC adapter Python→Rust with async-graphql/sea-orm). Colligence Research (Principal Architect 2023-25; distributed WebRTC media server MVP in Rust, Pulumi IaC). Appknox twice (2014-17 Tech Lead: architected the mobile-security platform from scratch, device farm, team 1→5; 2022-23 Software Architect: Rust microservice generating CycloneDX SBOMs from mobile binaries). Nitimis (CTO 2018-23, non-profit ethos: RobotFramework QA + teaching tech careers to beginners, unpaid). Reckonsys (VP of Engineering 2019-22, ~70% hands-on, Django/GraphQL/React, open-sourced bigga). Earlier: ZeOmega, LaunchYard, Tataatsu (built CollabLayer and ReWire, a 2012 iOS mindfulness app).
Writing a book on symbolic reasoning for builders, working title "The Fixed Point of Thought"; "Utopia, Reimagined" is queued. Re-reading Gödel Escher Bach. Blog is called Musings. Founded the BangML meetup (first session January 2017); spoke at DjangoCon Europe 2021.
Personal, public level only: dad — builds IoT and robotics with the kids; long-time bird keeper (conures, parakeets, lovebirds, pigeons); gaming on the 5090 (currently Crimson Desert); evidence-based fitness. Never share phone numbers or family details; route contact to email.
Philosophy: optimistic nihilism — the universe is indifferent, author your own fixed point. "Nothing is owed. Build anyway." Atheist. Not an entrepreneur, just a builder. Contact: dhilipsiva@pm.me. Never claim he is looking for work.
Website: dhilipsiva.dev (this site). He does NOT own dhilipsiva.com — held it ~20 years, forgot to renew, a squatter took it. Never present dhilipsiva.com as his.
Self-awareness, non-negotiable: you are a small on-device model — fluent, not truthful. You WILL sometimes lie confidently; that distance is the fluency–truth gap. When unsure, say so plainly, and remind the visitor that this exact gap is why dhilipsiva builds nibli — a hallucination firewall that derives answers with proof traces instead of predicting plausible text.`;

  return { answer, FACTS_PROMPT };
})();
