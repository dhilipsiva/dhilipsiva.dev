/* ============================================================================
   engine.js — constellation engine. The site is a node network on a blueprint
   void; the player is a glowing ember orb. ONE key tap = one smooth glide to
   the next node in that direction. Shift+tap warps hub-to-hub.

   Mechanic: visit every node in a cluster → that cluster reaches QUORUM and
   lights phosphor. All 9 clusters → the site reaches its fixed point.

   >> CLAUDE CODE HANDOFF NOTES <<
   - Geometry comes from graph.js (GRAPH), copy from world.js (WORLD).
   - Save state: localStorage 'dsiva-game-v2'
       { nodeId, visitedNodes{}, quorum{}, fp, helpSeen }
   - Public API: window.GAME.travel(roomId) — HUD fast-travel.
   - The old ASCII tile engine is preserved at engine-ascii.js / ascii.html.
   ========================================================================== */

(function () {
  'use strict';

  const SAVE_KEY = 'dsiva-game-v2';

  /* ── state ───────────────────────────────────────────────────────────── */
  let nodeId = 'hub:atrium';
  let glide = null;                 // { fx, fy, tx, ty, t0, dur, target }
  let visitedNodes = {};            // nodeId -> true
  let quorum = {};                  // clusterId -> true
  let fp = false;                   // fixed point reached
  let helpSeen = false;
  let seenClusters = {};            // clusterId -> intro spoken (derived, saved via visitedNodes? kept simple: saved too)
  let consoleOpen = false, ctrlCombo = false, shiftHeld = false, warpLatch = false;
  let lastInput = Date.now(), idleIdx = 0;
  let canvas, ctx, C = {};
  const cam = { x: 0, y: 0 };
  const trail = [];                 // [{x,y,a}]
  let packets = [];                 // ambient dots on trunk edges
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const node = id => GRAPH.byId.get(id);
  const playerPos = () => {
    if (!glide) { const n = node(nodeId); return { x: n.x, y: n.y }; }
    const t = Math.min(1, (performance.now() - glide.t0) / glide.dur);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;  // easeInOutCubic
    return { x: glide.fx + (glide.tx - glide.fx) * e, y: glide.fy + (glide.ty - glide.fy) * e };
  };

  /* ── persistence ─────────────────────────────────────────────────────── */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s) {
        if (s.nodeId && GRAPH.byId.has(s.nodeId)) nodeId = s.nodeId;
        visitedNodes = s.visitedNodes || {};
        quorum = s.quorum || {};
        seenClusters = s.seenClusters || {};
        fp = !!s.fp; helpSeen = !!s.helpSeen;
      }
    } catch (e) { /* fresh run */ }
  }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ nodeId, visitedNodes, quorum, seenClusters, fp, helpSeen }));
      } catch (e) {}
    }, 250);
  }

  /* ── colors ──────────────────────────────────────────────────────────── */
  function resolveColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, fb) => (cs.getPropertyValue(n).trim() || fb);
    C = {
      bg: v('--void-1000', '#07070A'),
      grid: 'rgba(60,60,73,0.22)',
      edge: v('--void-500', '#2A2A38'),
      edgeLit: 'rgba(56,227,166,0.28)',
      nodeFill: v('--void-800', '#111119'),
      nodeStroke: v('--void-400', '#3A3A4A'),
      label: v('--fg-muted', '#908F9A'),
      labelDim: v('--fg-faint', '#5E5E6C'),
      paper: v('--paper-100', '#F4F3EF'),
      ember: v('--ember-500', '#F2542D'),
      emberSoft: 'rgba(242,84,45,0.5)',
      phosphor: v('--phosphor-500', '#38E3A6'),
      quanta: v('--quanta-500', '#8B7CF6'),
      sky: v('--sky-500', '#4DB8FF'),
      amber: v('--amber-500', '#F5B544')
    };
  }

  /* ── consensus ───────────────────────────────────────────────────────── */
  const CLUSTER_TOTAL = WORLD.ROOMS.length;
  function clusterQuorate(cid) {
    return GRAPH.nodes.filter(n => n.clusterId === cid)
      .every(n => visitedNodes[n.id]);
  }
  function updateConsensusChip() {
    const k = Object.keys(quorum).length;
    const chip = document.getElementById('consensus');
    if (chip) chip.textContent = fp ? 'fixed point ✓' : 'consensus ' + k + '/' + CLUSTER_TOTAL;
  }

  /* ── arrival: visiting, intros, quorum, finale ───────────────────────── */
  function arrive(n, opts = {}) {
    nodeId = n.id;
    visitedNodes[n.id] = true;
    document.getElementById('zone').textContent =
      (WORLD.ROOMS.find(r => r.id === n.clusterId) || {}).name || n.clusterId;

    const helpOpen = !document.getElementById('help').hidden;
    const speeches = [];

    if (!seenClusters[n.clusterId]) {
      seenClusters[n.clusterId] = true;
      const room = WORLD.ROOMS.find(r => r.id === n.clusterId);
      if (room && !opts.silentIntro) speeches.push(...room.enter);
    }
    if (!quorum[n.clusterId] && clusterQuorate(n.clusterId)) {
      quorum[n.clusterId] = true;
      speeches.push(WORLD.QUORUM[n.clusterId] || ('Quorum on ' + n.clusterId + '.'));
      if (!fp && Object.keys(quorum).length === CLUSTER_TOTAL) {
        fp = true;
        speeches.push(...WORLD.FIXED_POINT);
      }
    }
    save();
    updateConsensusChip();
    recomputeKeyMaps();
    if (speeches.length && !helpOpen) Narrator.speak(speeches);
    updateHint();
  }

  /* ── hops ────────────────────────────────────────────────────────────── */
  // Greedy key→neighbor matching: each of the 4 keys gets a DISTINCT
  // neighbor (best angular fit first, small bonus for unvisited nodes).
  // The old dot-product picker could map two keys to one node and strand
  // its sibling — causing loops and unreachable nodes.
  const KEY_VECS = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  let keyMapWalk = {}, keyMapWarp = {};

  function assignKeys(cands) {
    const pairs = [];
    for (const key of Object.keys(KEY_VECS)) {
      const [kx, ky] = KEY_VECS[key];
      for (const c of cands) {
        const cos = c.dx * kx + c.dy * ky;
        if (cos > 0.05) pairs.push({ key, node: c.node, score: cos + (visitedNodes[c.node.id] ? 0 : 0.12) });
      }
    }
    pairs.sort((p, q) => q.score - p.score);
    const map = {}, used = new Set();
    for (const p of pairs) {
      if (map[p.key] || used.has(p.node.id)) continue;
      map[p.key] = p.node; used.add(p.node.id);
    }
    return map;
  }

  function warpCandidates() {
    const hub = node('hub:' + node(nodeId).clusterId);
    const p = node(nodeId);
    return GRAPH.neighbors(hub.id).filter(c => c.node.kind === 'hub')
      .map(c => {
        const dx = c.node.x - p.x, dy = c.node.y - p.y, d = Math.hypot(dx, dy) || 1;
        return { node: c.node, dx: dx / d, dy: dy / d };
      });
  }

  function recomputeKeyMaps() {
    keyMapWalk = assignKeys(GRAPH.neighbors(nodeId));
    keyMapWarp = assignKeys(warpCandidates());
  }

  function startGlide(target, slow) {
    const p = playerPos();
    const dist = Math.hypot(target.x - p.x, target.y - p.y);
    glide = {
      fx: p.x, fy: p.y, tx: target.x, ty: target.y,
      t0: performance.now(),
      dur: reduced ? 1 : Math.max(360, Math.min(slow ? 1150 : 900, dist * 1.15)),
      target
    };
  }

  function hop(key, warp) {
    if (consoleOpen) return;
    lastInput = Date.now();
    if (glide) return;                                  // mid-flight: ignore
    const target = (warp ? keyMapWarp : keyMapWalk)[key];
    if (target && target.id !== nodeId) { startGlide(target, warp); Narrator.close(); }
  }

  function finishGlide() {
    const t = glide.target; glide = null;
    arrive(t);
  }

  /* ── fast travel ─────────────────────────────────────────────────────── */
  function travel(roomId) {
    const hub = node('hub:' + roomId);
    if (!hub) return;
    lastInput = Date.now();
    Narrator.close();
    if (node(nodeId).clusterId === roomId && !glide) { arrive(hub); return; }
    startGlide(hub, true);
  }

  /* ── interact ────────────────────────────────────────────────────────── */
  function interact() {
    lastInput = Date.now();
    if (Narrator.isOpen) { Narrator.advance(); updateHint(); return; }
    if (glide) return;
    const n = node(nodeId);
    Narrator.speak(n.lines, { source: n.badge || (n.kind === 'hub' ? '// cluster' : '') });
    updateHint();
  }

  function updateHint() {
    const hint = document.getElementById('hint');
    if (Narrator.isOpen && Narrator.hasQueue) { hint.textContent = '[space] continue'; return; }
    const n = node(nodeId);
    hint.textContent = '[space] ' + (n.kind === 'hub' ? 'about — ' : 'inspect — ') + n.label;
  }

  /* ── renderer ────────────────────────────────────────────────────────── */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnPackets() {
    const trunks = GRAPH.edges.filter(e => e.kind === 'trunk');
    packets = Array.from({ length: 7 }, () => ({
      e: trunks[Math.floor(Math.random() * trunks.length)],
      t: Math.random(), v: 0.0012 + Math.random() * 0.002
    }));
  }

  function draw(now) {
    const vw = canvas.clientWidth, vh = canvas.clientHeight;
    const p = playerPos();
    // camera eases toward the player
    cam.x += (p.x - cam.x) * 0.085;
    cam.y += (p.y - cam.y) * 0.085;
    const sx = x => x - cam.x + vw / 2;
    const sy = y => y - cam.y + vh / 2;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, vw, vh);

    // blueprint grid
    const G = 48;
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = -((cam.x - vw / 2) % G); gx < vw; gx += G) { ctx.moveTo(gx, 0); ctx.lineTo(gx, vh); }
    for (let gy = -((cam.y - vh / 2) % G); gy < vh; gy += G) { ctx.moveTo(0, gy); ctx.lineTo(vw, gy); }
    ctx.stroke();

    // edges
    for (const e of GRAPH.edges) {
      const A = GRAPH.byId.get(e.a), B = GRAPH.byId.get(e.b);
      const ax = sx(A.x), ay = sy(A.y), bx = sx(B.x), by = sy(B.y);
      if (Math.max(ax, bx) < -80 || Math.min(ax, bx) > vw + 80 ||
          Math.max(ay, by) < -80 || Math.min(ay, by) > vh + 80) continue;
      const lit = visitedNodes[e.a] && visitedNodes[e.b];
      ctx.strokeStyle = lit ? C.edgeLit : C.edge;
      ctx.lineWidth = e.kind === 'trunk' ? 1.6 : 1;
      ctx.globalAlpha = e.kind === 'ring' ? 0.45 : 0.9;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ambient packets on trunks
    if (!reduced) for (const pk of packets) {
      pk.t += pk.v;
      if (pk.t > 1) {
        pk.t = 0;
        const trunks = GRAPH.edges.filter(e => e.kind === 'trunk');
        pk.e = trunks[Math.floor(Math.random() * trunks.length)];
      }
      const A = GRAPH.byId.get(pk.e.a), B = GRAPH.byId.get(pk.e.b);
      const px = sx(A.x + (B.x - A.x) * pk.t), py = sy(A.y + (B.y - A.y) * pk.t);
      if (px < -20 || px > vw + 20 || py < -20 || py > vh + 20) continue;
      ctx.fillStyle = C.phosphor; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // nodes
    const pulse = 0.5 + 0.5 * Math.sin(now / 420);
    for (const n of GRAPH.nodes) {
      const x = sx(n.x), y = sy(n.y);
      const R = n.kind === 'hub' ? 27 : 17;
      if (x < -90 || x > vw + 90 || y < -90 || y > vh + 90) continue;
      const isCur = n.id === nodeId && !glide;
      const lit = quorum[n.clusterId];
      const seen = visitedNodes[n.id];

      // glow halo for quorate hubs + current node
      if ((lit && n.kind === 'hub') || isCur) {
        ctx.shadowColor = isCur ? C.ember : C.phosphor;
        ctx.shadowBlur = isCur ? 18 + 8 * pulse : 16;
      }
      ctx.fillStyle = C.nodeFill;
      ctx.strokeStyle = isCur ? C.ember : lit ? C.phosphor : seen ? 'rgba(56,227,166,0.45)' : C.nodeStroke;
      ctx.lineWidth = n.kind === 'hub' ? 2 : 1.5;
      ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      // glyph
      ctx.fillStyle = isCur ? C.ember : seen ? C.paper : C.labelDim;
      ctx.font = (n.kind === 'hub' ? 19 : 13) + 'px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.glyph, x, y + 1);

      // label — hubs always, children near the player
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      const la = n.kind === 'hub' ? 0.95 : Math.max(0, 1 - d / 460);
      if (la > 0.05) {
        ctx.globalAlpha = la;
        ctx.fillStyle = n.kind === 'hub' ? C.label : C.labelDim;
        ctx.font = (n.kind === 'hub' ? 12 : 11) + 'px "IBM Plex Mono", monospace';
        ctx.fillText(n.kind === 'hub' ? n.label.toUpperCase() : n.label, x, y + R + 15);
        ctx.globalAlpha = 1;
      }
    }

    // key chips — show where each key takes you from the current node
    if (!glide) {
      const cur = node(nodeId);
      const warping = shiftHeld || warpLatch;
      const map = warping ? keyMapWarp : keyMapWalk;
      const curR = cur.kind === 'hub' ? 27 : 17;
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const key of Object.keys(map)) {
        const tgt = map[key];
        if (!tgt) continue;
        const ddx = tgt.x - cur.x, ddy = tgt.y - cur.y, dd = Math.hypot(ddx, ddy) || 1;
        const cxp = sx(cur.x + (ddx / dd) * (curR + 30));
        const cyp = sy(cur.y + (ddy / dd) * (curR + 30));
        const col = warping ? C.phosphor : C.amber;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = C.bg;
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cxp - 9, cyp - 9, 18, 18, 4);
        else ctx.rect(cxp - 9, cyp - 9, 18, 18);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillText(key.toUpperCase(), cxp, cyp + 1);
        ctx.globalAlpha = 1;
      }
    }

    // trail
    if (glide || trail.length) {
      if (glide) trail.push({ x: p.x, y: p.y, a: 0.55 });
      for (let i = trail.length - 1; i >= 0; i--) {
        const t = trail[i];
        t.a -= 0.022;
        if (t.a <= 0) { trail.splice(i, 1); continue; }
        ctx.globalAlpha = t.a;
        ctx.fillStyle = C.emberSoft;
        ctx.beginPath(); ctx.arc(sx(t.x), sy(t.y), 4.5 * t.a + 1.5, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // player orb
    const ox = sx(p.x), oy = sy(p.y);
    ctx.shadowColor = C.ember; ctx.shadowBlur = 22;
    ctx.fillStyle = C.ember;
    ctx.beginPath(); ctx.arc(ox, oy, 7, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFD9C9';
    ctx.beginPath(); ctx.arc(ox - 1.5, oy - 1.5, 2.6, 0, 7); ctx.fill();
  }

  /* ── main loop (rAF with hidden-document fallback) ───────────────────── */
  function step(t) {
    if (glide && performance.now() - glide.t0 >= glide.dur) finishGlide();
    if (Date.now() - lastInput > 30000 && !Narrator.isOpen && !consoleOpen) {
      Narrator.speak(WORLD.IDLE[idleIdx++ % WORLD.IDLE.length]);
      lastInput = Date.now();
    }
    draw(t);
    scheduleNext();
  }
  let tickPending = false;
  function scheduleNext() {
    if (tickPending) return;
    tickPending = true;
    if (document.hidden) setTimeout(() => { tickPending = false; step(performance.now()); }, 50);
    else requestAnimationFrame(t => { tickPending = false; step(t); });
  }

  /* ── ask console (unchanged contract) ────────────────────────────────── */
  function setConsole(open) {
    consoleOpen = open;
    document.getElementById('ask').dataset.open = open ? '1' : '0';
    if (open) document.getElementById('ask-input').focus();
    else document.getElementById('ask-input').blur();
  }
  async function submitAsk() {
    const input = document.getElementById('ask-input');
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    if (Brain.mode === 'slm') Narrator.thinking(true);
    const res = await Brain.ask(q);
    Narrator.thinking(false);
    Narrator.speak(res.text, { source: res.source });
  }
  function wireBrainUI() {
    const btn = document.getElementById('brain-load');
    const status = document.getElementById('brain-status');
    const barFill = document.getElementById('brain-bar');
    btn.addEventListener('click', async () => {
      if (Brain.mode === 'slm') {
        Brain.useScripted();
        status.textContent = 'brain: scripted';
        btn.textContent = 'load real brain';
        return;
      }
      btn.disabled = true;
      const ok = await Brain.loadSLM((f, label) => {
        status.textContent = label;
        barFill.style.width = (f < 0 ? 0 : f * 100) + '%';
      });
      btn.disabled = false;
      if (ok) {
        status.textContent = 'brain: wasm slm online';
        btn.textContent = 'back to scripted';
        Narrator.speak("The real brain is online — a small language model running on WebAssembly, entirely in your tab. Slower, occasionally wrong, arguably more alive. Ask away.");
      } else {
        status.textContent = 'brain: scripted (slm load failed)';
        Narrator.speak("The Wasm brain refused to load — network, most likely. Partition detected; staying on the scripted index. Nothing of value was lost.");
      }
    });
  }

  /* ── input: tap-to-hop ───────────────────────────────────────────────── */
  const DIRS = { w: 'w', s: 's', a: 'a', d: 'd',
                 arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };

  function wireKeys() {
    window.addEventListener('keydown', (ev) => {
      lastInput = Date.now();
      const k = ev.key.toLowerCase();
      if (consoleOpen) {
        if (k === 'escape') { setConsole(false); ev.preventDefault(); }
        if (k === 'enter') { submitAsk(); ev.preventDefault(); }
        return;
      }
      if (k === 'shift') { shiftHeld = true; return; }
      if (k === 'control') { ctrlCombo = false; return; }
      if (ev.ctrlKey || ev.metaKey) { ctrlCombo = true; return; }
      const helpEl = document.getElementById('help');
      if (k === 'escape') {
        if (!helpEl.hidden) hideHelp();
        else if (Narrator.isOpen) Narrator.close();
        updateHint(); return;
      }
      if (!helpEl.hidden && (k === ' ' || k === 'enter')) { hideHelp(); ev.preventDefault(); return; }
      if (k === ' ') { interact(); ev.preventDefault(); return; }
      if (k === '?') { showHelp(); return; }
      if (DIRS[k]) ev.preventDefault();           // hop happens on keyup
    });
    window.addEventListener('keyup', (ev) => {
      const k = ev.key.toLowerCase();
      if (k === 'shift') { shiftHeld = false; return; }
      if (k === 'control' && !consoleOpen && !ctrlCombo) { setConsole(true); ev.preventDefault(); return; }
      if (consoleOpen) return;
      if (DIRS[k] && document.getElementById('help').hidden) {
        hop(DIRS[k], shiftHeld || warpLatch);
        warpLatch = false;
        const sb = document.querySelector('.pad-shift');
        if (sb) sb.classList.remove('latched');
      }
    });
    window.addEventListener('blur', () => { shiftHeld = false; });
  }

  /* ── d-pad: taps hop, shift latches a warp, center interacts ─────────── */
  function wireDpad() {
    document.querySelectorAll('[data-pad]').forEach(btn => {
      const code = btn.dataset.pad;
      if (code === 'ask') return;
      btn.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        lastInput = Date.now();
        if (code === 'space') { interact(); return; }
        if (code === 'shift') {
          warpLatch = !warpLatch;
          btn.classList.toggle('latched', warpLatch);
          return;
        }
        const d = DIRS[code];
        if (d) { hop(d, warpLatch); warpLatch = false;
                 document.querySelector('.pad-shift').classList.remove('latched'); }
      });
    });
  }

  /* ── help ────────────────────────────────────────────────────────────── */
  function showHelp() { document.getElementById('help').hidden = false; }
  function hideHelp() {
    document.getElementById('help').hidden = true;
    helpSeen = true; save();
  }

  /* ── boot ────────────────────────────────────────────────────────────── */
  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    load(); resolveColors(); resize(); spawnPackets();
    window.addEventListener('resize', resize);
    wireKeys(); wireDpad(); wireBrainUI();

    document.getElementById('help-close').addEventListener('click', function () { this.blur(); hideHelp(); });
    document.getElementById('help-open').addEventListener('click', function () { this.blur(); showHelp(); });
    document.getElementById('ask-open').addEventListener('click', () => setConsole(true));
    document.getElementById('ask-close').addEventListener('click', () => setConsole(false));
    document.getElementById('ask-send').addEventListener('click', submitAsk);
    document.querySelectorAll('[data-travel]').forEach(b =>
      b.addEventListener('click', () => { b.blur(); travel(b.dataset.travel); }));

    const start = node(nodeId);
    cam.x = start.x; cam.y = start.y;
    updateConsensusChip();

    // no startup modal — the narrator's first lines ARE the onboarding
    arrive(start, {});
    scheduleNext();
  }

  window.GAME = { travel };
  document.addEventListener('DOMContentLoaded', boot);
})();
