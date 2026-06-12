/* ============================================================================
   chat.js — the conversation with the on-device twin.
   One surface: user prompts, his replies (typewriter, emotive face avatar,
   optional voice), and MCP app cards rendering inline — parameterized by
   the prompt.

   Reply pipeline per prompt:
     1. MCP.route(prompt)        — deterministic app routing (always on)
     2. Brain.ask(prompt)        — scripted index, or the candle Rust→WASM SLM
                                   (which may itself emit a TOOL call that
                                   overrides the router)
     3. bubble + app card        — rendered into the same column
   Voice in:  hold the mic → MediaRecorder → 16kHz → candle Whisper (wasm).
   Voice out: speechSynthesis (system voice, on device) — the endgame is a
              candle-cloned voice, same story as the fine-tuned text model.
   Face: a generic emotive rig — set data-emotion on the avatar SVG.
   ========================================================================== */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const thread = $('thread');
  const input = $('composer-input');
  const statusEl = $('brain-status');
  const barFill = $('brain-bar');
  const micBtn = $('mic');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the emotive face ────────────────────────────────────────────────── */
  let lastFace = null;
  function faceOf(row) { return row.querySelector('.face'); }
  function setEmotion(row, emotion) {
    const f = faceOf(row);
    if (f) f.dataset.emotion = emotion;
  }
  // talking is a lock: typewriter and TTS can overlap; the face keeps
  // flapping until both release, then settles on the row's base emotion.
  function startTalk(row) {
    row.__talk = (row.__talk || 0) + 1;
    setEmotion(row, 'talking');
  }
  function endTalk(row) {
    row.__talk = Math.max(0, (row.__talk || 0) - 1);
    if (row.__talk === 0) setEmotion(row, row.__base || 'neutral');
  }
  function setBaseEmotion(row, emotion) {
    row.__base = emotion;
    if (!row.__talk) setEmotion(row, emotion);
  }

  /* ── voice out (TTS) ─────────────────────────────────────────────────── */
  const VOICE_KEY = 'dsiva-voice';
  let voiceOn = false;
  try { voiceOn = localStorage.getItem(VOICE_KEY) === 'on'; } catch (e) {}

  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    return vs.find(v => v.lang === 'en-IN')
        || vs.find(v => v.lang && v.lang.startsWith('en') && v.localService)
        || vs.find(v => v.lang && v.lang.startsWith('en'))
        || null;
  }
  function speak(text, row) {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const clean = text.replace(/https?:\S+/g, '').replace(/[∴⊢∀⟶❯·]/g, '');
      const u = new SpeechSynthesisUtterance(clean);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 1.02;
      u.pitch = 0.92;
      if (row) {
        startTalk(row);
        u.onend = () => endTalk(row);
        u.onerror = () => endTalk(row);
      }
      speechSynthesis.speak(u);
    } catch (e) { /* voice is garnish — never break the reply */ }
  }
  function wireVoiceToggle() {
    const btn = $('voice-toggle');
    if (!btn) return;
    if (!('speechSynthesis' in window)) { btn.hidden = true; return; }
    const paint = () => {
      btn.setAttribute('aria-pressed', String(voiceOn));
      btn.textContent = '∿ voice: ' + (voiceOn ? 'on' : 'off');
    };
    paint();
    btn.addEventListener('click', () => {
      voiceOn = !voiceOn;
      try { localStorage.setItem(VOICE_KEY, voiceOn ? 'on' : 'off'); } catch (e) {}
      if (!voiceOn) speechSynthesis.cancel();
      paint();
    });
  }

  /* ── bubbles ─────────────────────────────────────────────────────────── */
  function scrollDown() { thread.scrollTop = thread.scrollHeight; }

  function userBubble(text) {
    const row = document.createElement('div');
    row.className = 'msg msg--user';
    row.innerHTML = '<div class="msg__bubble"></div>';
    row.querySelector('.msg__bubble').textContent = text;
    thread.append(row);
    scrollDown();
  }

  function twinRow() {
    const row = document.createElement('div');
    row.className = 'msg msg--twin';
    const face = $('face-template').content.cloneNode(true);
    const avatar = document.createElement('div');
    avatar.className = 'msg__avatar';
    avatar.append(face);
    const body = document.createElement('div');
    body.className = 'msg__body';
    row.append(avatar, body);
    thread.append(row);
    lastFace = row;
    return { row, body, avatar };
  }

  function typeInto(row, el, text, done) {
    if (reduced) { el.textContent = text; done && done(); return; }
    let i = 0;
    startTalk(row);
    const t = setInterval(() => {
      i = Math.min(text.length, i + 3);
      el.textContent = text.slice(0, i);
      scrollDown();
      if (i >= text.length) {
        clearInterval(t);
        endTalk(row);
        done && done();
      }
    }, 16);
  }

  // opts: { emotion: base emotion once done, voice: speak it }
  function twinSay(text, source, appNode, opts = {}) {
    const { row, body } = twinRow();
    row.__base = opts.emotion || 'neutral';
    const bubble = document.createElement('div');
    bubble.className = 'msg__bubble';
    const p = document.createElement('p');
    bubble.append(p);
    if (source) {
      const tag = document.createElement('span');
      tag.className = 'msg__src';
      tag.textContent = source;
      bubble.append(tag);
    }
    body.append(bubble);
    scrollDown();
    if (opts.voice !== false) speak(text, row);
    typeInto(row, p, text, () => {
      if (appNode) {
        body.append(appNode);
        setBaseEmotion(row, 'happy');
        scrollDown();
      }
    });
    return row;
  }

  function thinkingRow() {
    const { row, body } = twinRow();
    row.classList.add('msg--thinking');
    setEmotion(row, 'thinking');
    row.__base = 'thinking';
    body.innerHTML = '<div class="msg__bubble"><span class="think-dots"><i>·</i><i>·</i><i>·</i></span></div>';
    scrollDown();
    return row;
  }

  /* ── the scripted-vs-twin gap ────────────────────────────────────────── */
  // The scripted index must never pass for the model. A CTA button loads the
  // twin through the SAME picker flow (progress, swap bubble, rollback), and
  // a one-time nudge fires after a few canned answers — sooner on
  // connections that can take the 145MB, never for Data-Saver users.
  function twinCta(label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'msg__cta';
    b.textContent = label;
    b.addEventListener('click', () => {
      const sel = $('model-select');
      if (sel.disabled || Brain.mode === 'slm' || Brain.loading) return;
      b.disabled = true;
      sel.value = 'twin';
      sel.dispatchEvent(new Event('change'));
    });
    return b;
  }

  const conn = navigator.connection;
  const NUDGE_AFTER = (conn && conn.saveData) ? Infinity
    : (conn && conn.effectiveType === '4g') ? 1 : 3;
  let scriptedAnswers = 0;
  let nudged = false;

  function maybeNudge() {
    if (nudged || Brain.mode === 'slm' || scriptedAnswers < NUDGE_AFTER) return;
    nudged = true;
    twinSay(
      "By the way — every answer so far was canned. You're on the keyword index. Load the twin and you get the model that improvises in his voice (and lies — that's the demo).",
      'system',
      twinCta('⊳ load the twin · 145MB'),
      { emotion: 'neutral', voice: false }
    );
  }

  /* ── the reply pipeline ──────────────────────────────────────────────── */
  // Ephemeral conversation memory: in-memory only, never persisted, dies on
  // reload. Passed to the brain so follow-up questions resolve their "it".
  const history = [];
  const HISTORY_MAX = 12; // messages (6 exchanges)

  let busy = false;
  async function submit(raw) {
    const q = (raw !== undefined ? raw : input.value).trim();
    if (!q || busy) return;
    busy = true;
    input.value = '';
    userBubble(q);

    const routed = window.MCP.route(q);
    let thinking = null;
    if (Brain.mode === 'slm') thinking = thinkingRow();

    const res = await Brain.ask(q, { history: history.slice() });
    if (thinking) thinking.remove();
    history.push({ role: 'user', content: q }, { role: 'assistant', content: res.text });
    if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);

    // the model's own tool call (qwen) wins; the router is the fallback
    const call = res.toolCall || routed;
    const appNode = call ? await window.MCP.render(call.app, call.params) : null;
    const noMatch = res.source && res.source.includes('no match');
    twinSay(res.text, res.source, appNode, { emotion: noMatch ? 'sorry' : 'neutral' });
    if (res.source && res.source.startsWith('scripted index')) {
      scriptedAnswers += 1;
      maybeNudge();
    }
    busy = false;
  }

  /* ── model picker ────────────────────────────────────────────────────── */
  function setStatus(label, frac) {
    statusEl.textContent = label;
    if (barFill) barFill.style.width = (frac === undefined || frac < 0 ? 0 : frac * 100) + '%';
  }

  function wireModelPicker() {
    const sel = $('model-select');
    const opts = [{ id: 'scripted', label: 'scripted index · 0MB' }];
    for (const [id, m] of Object.entries(Brain.models)) opts.push({ id, label: m.label + ' — ' + m.detail });
    sel.innerHTML = opts.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    sel.addEventListener('change', async () => {
      const v = sel.value;
      if (v === 'scripted') {
        Brain.useScripted();
        setStatus('brain: scripted index — twin not loaded', 0);
        return;
      }
      sel.disabled = true;
      const ok = await Brain.loadSLM(v, (f, label) => setStatus(label, f));
      sel.disabled = false;
      if (ok) {
        setStatus('brain: ' + Brain.models[v].label.split(' ·')[0] + ' · Rust→WASM', 1);
        twinSay("Brain swapped — a language model is now running entirely in your tab: candle, Rust compiled to WebAssembly. Fair warning, and I mean it: I will now lie confidently. Fluent ≠ true — mind the gap. nibli exists because of exactly this.", 'system', null, { emotion: 'happy' });
      } else {
        sel.value = Brain.activeModel || 'scripted';
        setStatus('brain: scripted (load failed)', 0);
      }
    });
  }

  /* ── voice input — candle Whisper ────────────────────────────────────── */
  let stt = null, sttReady = false, sttLoading = false, sttSeq = 0;
  const sttPending = new Map();

  function loadSTT() {
    if (sttReady) return Promise.resolve(true);
    if (sttLoading) return Promise.resolve(false);
    sttLoading = true;
    return new Promise((resolve) => {
      let w;
      try { w = new Worker('/play/app/stt-worker.js', { type: 'module' }); }
      catch (e) { sttLoading = false; setStatus('whisper failed to spawn', -1); resolve(false); return; }
      w.onerror = () => { sttLoading = false; setStatus('whisper failed — typing still works', -1); resolve(false); };
      w.onmessage = (e) => {
        const m = e.data;
        if (m.status === 'progress') setStatus(m.label, m.frac);
        else if (m.status === 'ready') {
          stt = w; sttReady = true; sttLoading = false;
          w.onmessage = (ev) => {
            const r = ev.data;
            const p = sttPending.get(r.id);
            if (!p) return;
            sttPending.delete(r.id);
            r.status === 'text' ? p.resolve(r.text) : p.reject(new Error(r.error));
          };
          setStatus('whisper online — hold the mic to talk', 1);
          resolve(true);
        } else if (m.status === 'error') {
          sttLoading = false;
          setStatus('whisper load failed — typing still works', -1);
          try { w.terminate(); } catch (err) {}
          resolve(false);
        }
      };
      w.postMessage({ cmd: 'load' });
    });
  }

  function transcribe(pcm) {
    return new Promise((resolve, reject) => {
      const id = ++sttSeq;
      sttPending.set(id, { resolve, reject });
      stt.postMessage({ cmd: 'transcribe', id, pcm }, [pcm.buffer]);
    });
  }

  async function blobToPcm16k(blob) {
    const arr = await blob.arrayBuffer();
    const probe = new AudioContext();
    const decoded = await probe.decodeAudioData(arr);
    probe.close();
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return rendered.getChannelData(0).slice();
  }

  function wireMic() {
    if (!navigator.mediaDevices || !window.MediaRecorder) { micBtn.hidden = true; return; }
    let rec = null, chunks = [];

    const start = async () => {
      if (rec) return;
      if (!sttReady) {
        micBtn.classList.add('mic--loading');
        const ok = await loadSTT();
        micBtn.classList.remove('mic--loading');
        if (!ok) return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        rec = new MediaRecorder(stream);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          micBtn.classList.remove('mic--rec');
          if (lastFace) setBaseEmotion(lastFace, 'neutral');
          try {
            setStatus('transcribing on device…', 0.5);
            const pcm = await blobToPcm16k(new Blob(chunks, { type: rec.mimeType }));
            const text = await transcribe(pcm);
            setStatus('whisper online — hold the mic to talk', 1);
            if (text) { input.value = (input.value ? input.value + ' ' : '') + text; input.focus(); }
            else {
              setStatus('heard only the void — try again, closer', 1);
              if (lastFace) setBaseEmotion(lastFace, 'sorry');
            }
          } catch (err) {
            console.warn('[stt]', err);
            setStatus('transcription failed — typing still works', -1);
          }
          rec = null;
        };
        rec.start();
        micBtn.classList.add('mic--rec');
        if (lastFace) setBaseEmotion(lastFace, 'listening');
        setStatus('listening… release to transcribe', 1);
      } catch (err) {
        console.warn('[mic]', err);
        setStatus('mic permission denied — typing still works', -1);
        rec = null;
      }
    };
    const stop = () => { if (rec && rec.state === 'recording') rec.stop(); };

    micBtn.addEventListener('pointerdown', e => { e.preventDefault(); start(); });
    micBtn.addEventListener('pointerup', stop);
    micBtn.addEventListener('pointerleave', stop);
    micBtn.addEventListener('pointercancel', stop);
  }

  /* ── suggestions ─────────────────────────────────────────────────────── */
  const SUGGESTIONS = [
    'what have you built?',
    'show me your rust projects',
    'tell me about the book',
    'what are you working on now?',
    'what do you use?',
    'how do I reach you?'
  ];

  function wireSuggestions() {
    const box = $('suggestions');
    for (const s of SUGGESTIONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill';
      b.textContent = s;
      b.addEventListener('click', () => { submit(s); });
      box.append(b);
    }
  }

  /* ── boot ────────────────────────────────────────────────────────────── */
  async function boot() {
    await window.MCP.load();
    wireModelPicker();
    wireSuggestions();
    wireMic();
    wireVoiceToggle();
    setStatus('brain: scripted index — twin not loaded', 0);

    $('composer-send').addEventListener('click', () => submit());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    const nibliLink = $('nibli-link');
    if (nibliLink) nibliLink.addEventListener('click', () => submit('what is nibli?'));

    twinSay(
      "Hi — I'm dhilipsiva's twin. Right now, the cheap version: a scripted keyword index — instant, canned, zero AI. The real me is a neural network fine-tuned on him, running entirely in your tab once you load it. Either way, ask about the projects, the book, the philosophy — I'll open the relevant app as we talk.",
      'scripted index · zero cookies',
      twinCta('⊳ load the twin · 145MB'),
      { emotion: 'happy', voice: false }
    );
    input.focus();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
