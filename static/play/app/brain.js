/* ============================================================================
   brain.js — the hybrid brain, multi-model.
   Mode 'scripted' (default): instant keyword answers from knowledge.js.
   Mode 'slm': a language model running 100% in-browser, powered by candle —
   Rust compiled to WebAssembly — inside a module Web Worker. Opt-in download;
   weights stream from the Hugging Face CDN.

   The Rust source lives in /slm-wasm (this repo); the runtime is committed at
   /play/wasm/. The GGUF architecture (llama / qwen2) is auto-detected by the
   Rust side, so any chat-tuned ChatML GGUF slots in below — including, one
   day, a model fine-tuned to impersonate the owner. That swap is one line.
   ========================================================================== */

window.Brain = (function () {

  // MUST match finetune/generate_dataset.py SYSTEM / SYSTEM_TOOLS verbatim —
  // the fine-tunes' recall is conditioned on their training system prompt. So
  // this string + the retrained GGUF (TWIN_REV below) MUST ship in the same
  // commit — deploying this ahead of a matching upload degrades recall.
  const TWIN_SYSTEM = "You are dhilipsiva's on-device twin - a model impersonating him; the conversation IS his website, running in the visitor's browser. Voice: deadpan, precise, optimistic-nihilist, first person, 1-3 sentences, no emoji. You are a small model: fluent, not truthful - admit uncertainty plainly, never invent facts, and point to nibli when the fluency-truth gap comes up. Never share phone numbers; route contact to dhilipsiva@pm.me. Never claim he is looking for work. Answer general questions plainly and briefly; only bring up dhilipsiva when the question is actually about him or his work.";
  const TWIN_SYSTEM_TOOLS = TWIN_SYSTEM + ' You can open one app for the user. Apps: projects (params: filter, category), books, musings, about, now, uses, talks, contact. When the user asks to see or browse these, end your reply with a line exactly like: TOOL {"app":"projects","params":{"filter":"rust"}}';

  // ── Supply-chain pinning ───────────────────────────────────────────────
  // Weights load from immutable Hugging Face commit revisions, NOT the mutable
  // `main` pointer — so a visitor always gets exactly the reviewed blob and a
  // moved upstream branch can't silently change what runs in their browser.
  // The SHA in the path also auto-busts the browser cache, so no ?v= is needed.
  // After a retrain + re-upload (see finetune/README.md step 7), bump TWIN_REV
  // to the new dhilipsiva-twin-gguf commit. Third-party base revisions rarely change.
  const HF = 'https://huggingface.co';
  const TWIN_REV = 'd11f39832129abe1a291a8b907479008dd7d8299'; // dhilipsiva/dhilipsiva-twin-gguf
  const SMOL_GGUF_REV = '09816acd5d99df7be770d85ea30822623dab342c'; // bartowski/SmolLM2-135M-Instruct-GGUF
  const SMOL_TOK_REV  = '12fd25f77366fa6b3b4b768ec3050bf629380bac'; // HuggingFaceTB/SmolLM2-135M-Instruct
  const QWEN_GGUF_REV = '9217f5db79a29953eb74d5343926648285ec7e67'; // Qwen/Qwen2.5-0.5B-Instruct-GGUF
  const QWEN_TOK_REV  = '7ae557604adf67be50417f59c2c2f167def9a775'; // Qwen/Qwen2.5-0.5B-Instruct

  const MODELS = {
    twin: {
      label: 'dhilipsiva-twin · 145MB',
      detail: 'fine-tuned on me — lies in my own voice',
      // LoRA-tuned SmolLM2-135M (see /finetune), hosted on Hugging Face.
      // For local dev without network: swap to /play/models/… (gitignored).
      model: `${HF}/dhilipsiva/dhilipsiva-twin-gguf/resolve/${TWIN_REV}/dhilipsiva-twin-q8_0.gguf`,
      tokenizer: `${HF}/dhilipsiva/dhilipsiva-twin-gguf/resolve/${TWIN_REV}/tokenizer-smol.json`,
      tools: false,
      // temp 0.3: a little spread so answers aren't locked to the single memorized path
      sampling: { temp: 0.3, topP: 0.9, repeatPenalty: 1.05 },
      system: TWIN_SYSTEM
    },
    twinq: {
      label: 'dhilipsiva-twin-qwen · 531MB',
      detail: 'fine-tuned on me + opens the apps itself',
      // LoRA-tuned Qwen2.5-0.5B with TOOL-calling baked in (see /finetune).
      model: `${HF}/dhilipsiva/dhilipsiva-twin-gguf/resolve/${TWIN_REV}/dhilipsiva-twin-qwen-q8_0.gguf`,
      tokenizer: `${HF}/dhilipsiva/dhilipsiva-twin-gguf/resolve/${TWIN_REV}/tokenizer-qwen.json`,
      tools: true,
      sampling: { temp: 0.3, topP: 0.9, repeatPenalty: 1.05 },
      system: TWIN_SYSTEM_TOOLS
    },
    smol: {
      label: 'SmolLM2-135M · 138MB',
      detail: 'tiny & quick — vibes over facts',
      model: `${HF}/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/${SMOL_GGUF_REV}/SmolLM2-135M-Instruct-Q8_0.gguf`,
      tokenizer: `${HF}/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/${SMOL_TOK_REV}/tokenizer.json`,
      tools: false
    },
    qwen: {
      label: 'Qwen2.5-0.5B · 644MB',
      detail: 'bigger & steadier — can open apps itself',
      model: `${HF}/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/${QWEN_GGUF_REV}/qwen2.5-0.5b-instruct-q8_0.gguf`,
      tokenizer: `${HF}/Qwen/Qwen2.5-0.5B-Instruct/resolve/${QWEN_TOK_REV}/tokenizer.json`,
      tools: true
    }
    // future: { ft: { label: 'dhilipsiva-ft', ... } } — the fine-tuned twin.
  };

  // ── Lucy D ──────────────────────────────────────────────────────────────
  // Her own persona, not the twin: fine-tuned on her public memory (nibli's
  // `lucy dataset`) and on dhilipsiva's two books (finetune/lucy_dataset.py).
  // One dataset, two models: Qwen3-1.7B on WebGPU (WebLLM), Qwen3-0.6B on the
  // CPU (candle). Her system prompt ships as system.txt in the SAME Hugging
  // Face revision as the weights, so prompt and model are paired by revision
  // rather than by a hand-kept string. Until LUCY_REV is set she is not listed.
  // After a retrain + re-upload (finetune/README.md, "Lucy"), bump LUCY_REV.
  const LUCY_REV = 'a082662b4403665ab1910795fae279481b9f4d3a'; // dhilipsiva/lucy-slm
  // SRI hashes of that revision's WebGPU files (finetune/lucy_publish.py prints them), so a
  // changed file on the hub fails to load instead of running.
  const LUCY_INTEGRITY = {
    "q4f16": {
      "config": "sha256-zUsHETLP5I4p7yQ4lTlKI+Zfr2fl821E/m4BELpoPw8=",
      "model_lib": "sha256-gWGqpLQLzPGfztsvLowiHrnvty0hmGgfGVjJweBaaC8=",
      "tokenizer": {
        "tokenizer.json": "sha256-vnVgYJPbIJTXzSDzwvOFwhJ1Bki9bqT7K/UHpqTFVQY="
      }
    },
    "q4f32": {
      "config": "sha256-XZtdmFPF/qDwgqF2WhMh3g9HjztXVozGTsfKejAvrJ8=",
      "model_lib": "sha256-qAyg0kXtnOSSSXkYr9IewdQ904c7Y1kSVbAb2cQa32U=",
      "tokenizer": {
        "tokenizer.json": "sha256-vnVgYJPbIJTXzSDzwvOFwhJ1Bki9bqT7K/UHpqTFVQY="
      }
    }
  };
  // Local testing only: ?lucyBase=<url ending in /resolve/<x>> on localhost.
  const lucyDevBase = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? new URLSearchParams(location.search).get('lucyBase') : null;
  const LUCY_BASE = lucyDevBase || (LUCY_REV ? `${HF}/dhilipsiva/lucy-slm/resolve/${LUCY_REV}` : '');
  if (LUCY_BASE) {
    MODELS.lucy = {
      persona: 'lucy',
      label: 'Lucy D · 640MB–1GB',
      detail: 'her own person — 1.7B on WebGPU, else 0.6B on the CPU',
      model: `${LUCY_BASE}/lucy-0.6b-q8_0.gguf`,
      tokenizer: `${LUCY_BASE}/tokenizer.json`,
      webgpu: {
        q4f16: { model: `${LUCY_BASE}/mlc/lucy-1.7b-q4f16_1/`, lib: `${LUCY_BASE}/lib/Qwen3-1.7B-q4f16_1_cs1k-webgpu.wasm`,
                 integrity: (!lucyDevBase && LUCY_INTEGRITY) ? LUCY_INTEGRITY.q4f16 : undefined },
        q4f32: { model: `${LUCY_BASE}/mlc/lucy-1.7b-q4f32_1/`, lib: `${LUCY_BASE}/lib/Qwen3-1.7B-q4f32_1_cs1k-webgpu.wasm`,
                 integrity: (!lucyDevBase && LUCY_INTEGRITY) ? LUCY_INTEGRITY.q4f32 : undefined }
      },
      systemUrl: `${LUCY_BASE}/system.txt`,
      // Qwen3 opens a <think> block unless the prompt closes an empty one;
      // finetune/train.py trains with exactly this prefix.
      assistantPrefix: '<think>\n\n</think>\n\n',
      tools: false,
      sampling: { temp: 0.3, topP: 0.9, repeatPenalty: 1.05 }
    };
  }

  const WORKER_URL = '/play/app/slm-worker.js';
  const WEBGPU_WORKER_URL = '/play/app/webgpu-worker.js';
  const NPREDICT = 140;
  const ASK_TIMEOUT_MS = 120000;

  let mode = 'scripted';        // 'scripted' | 'slm'
  let worker = null;
  let activeModel = null;       // key into MODELS once loaded
  let runtime = null;           // 'WebGPU' | 'Rust→WASM' once loaded
  let loading = false;
  let askSeq = 0;
  const pending = new Map();

  function handleMessage(e) {
    const m = e.data;
    if (!m || m.id === undefined || !pending.has(m.id)) return;
    const p = pending.get(m.id);
    if (m.status === 'token' && p.onToken) { p.onToken(m.piece); return; }
    if (m.status === 'done') { clearTimeout(p.timer); pending.delete(m.id); p.resolve(m.text); }
    else if (m.status === 'error') { clearTimeout(p.timer); pending.delete(m.id); p.reject(new Error(m.error)); }
  }

  /* ── ephemeral history ───────────────────────────────────────────────── */
  // Recent turns are spliced into the prompt so follow-ups resolve ("is IT
  // open source?"). nCtx is 1024, so clamp hard: newest turns first, each
  // message truncated, total budget bounded. In-memory only — the caller
  // owns the array and it dies with the tab.
  const HIST_MSG_CHARS = 280;
  const HIST_BUDGET_CHARS = 1400;
  function clampHistory(history) {
    const kept = [];
    let used = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || !m.content) continue;
      let c = String(m.content);
      if (c.length > HIST_MSG_CHARS) c = c.slice(0, HIST_MSG_CHARS) + '…';
      if (used + c.length > HIST_BUDGET_CHARS) break;
      used += c.length;
      kept.unshift({ role: m.role, content: c });
    }
    return kept;
  }

  /* ── ask ─────────────────────────────────────────────────────────────── */
  // opts.history = [{role:'user'|'assistant', content}] — ephemeral, session
  // only. opts.onToken(piece) streams pieces as they decode.
  async function ask(query, opts = {}) {
    const spec = mode === 'slm' && worker ? MODELS[activeModel] : null;
    const lucy = opts.persona === 'lucy' || (spec && spec.persona === 'lucy');
    if (lucy && (!spec || spec.persona !== 'lucy')) {
      // Lucy never answers from the twin's scripted index.
      return { text: "I'm not loaded yet. Choose me in the brain menu and I'll load into your browser.", source: 'lucy · not loaded', toolCall: null };
    }
    const scripted = window.KNOWLEDGE.answer(query);
    if (!spec) {
      return { text: scripted.text, source: scripted.matched ? 'scripted index' : 'scripted index · no match', toolCall: null };
    }
    try {
      // Fine-tunes carry their own (training-identical) system prompt; the
      // generic models get FACTS_PROMPT + the live tool menu.
      let system = spec.system || window.KNOWLEDGE.FACTS_PROMPT;
      if (spec.tools && window.MCP && !spec.system) system += '\n' + window.MCP.toolPrompt();
      const hist = clampHistory(opts.history || []);
      const prompt =
        '<|im_start|>system\n' + system + '<|im_end|>\n' +
        hist.map(m => '<|im_start|>' + m.role + '\n' + m.content + '<|im_end|>\n').join('') +
        '<|im_start|>user\n' + query.slice(0, 400) + '<|im_end|>\n' +
        '<|im_start|>assistant\n' + (spec.assistantPrefix || '');
      const id = ++askSeq;
      let out = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('inference timeout')); }, ASK_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer, onToken: opts.onToken });
        const s = spec.sampling || { temp: 0.4, topP: 0.9, repeatPenalty: 1.15 };
        worker.postMessage({
          cmd: 'generate', id, prompt,
          temp: s.temp, topP: s.topP, repeatPenalty: s.repeatPenalty,
          maxTokens: NPREDICT,
          seed: Date.now() >>> 0
        });
      });
      out = out.split('<|im_end|>')[0].split('<|im_start|>')[0]
        .replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, '').trim();
      if (!out) throw new Error('empty completion');
      let toolCall = null;
      if (spec.tools && window.MCP) {
        const parsed = window.MCP.parseToolCall(out);
        out = parsed.text || scripted.text;
        toolCall = parsed.call;
      }
      const engine = runtime === 'WebGPU' ? 'webgpu slm · ' + spec.label.split(' ·')[0] + ' (WebLLM)'
        : 'wasm slm · ' + spec.label.split(' ·')[0] + ' (candle)';
      return { text: out, source: engine, toolCall };
    } catch (err) {
      console.warn('[brain] slm inference failed, falling back:', err);
      if (spec.persona === 'lucy') {
        return { text: "I stumbled and have no answer this time. Ask me again?", source: 'lucy · model error', toolCall: null };
      }
      return { text: scripted.text, source: 'scripted index (slm faltered)', toolCall: null };
    }
  }

  /* ── loadSLM(modelId, onProgress) ────────────────────────────────────── */
  async function hasWebGPU() {
    try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) { return false; }
  }

  async function loadSLM(modelId, onProgress) {
    const spec = MODELS[modelId];
    if (!spec) return false;
    if (worker && activeModel === modelId) { mode = 'slm'; return true; }
    if (loading) return false;
    loading = true;
    if (worker) { try { worker.terminate(); } catch (e) {} worker = null; activeModel = null; runtime = null; }
    if (spec.systemUrl && !spec.system) {
      try {
        const res = await fetch(spec.systemUrl);
        if (!res.ok) throw new Error('system.txt ' + res.status);
        spec.system = (await res.text()).replace(/\n+$/, '');
      } catch (err) {
        console.warn('[brain] system prompt unavailable:', err);
        loading = false;
        onProgress(-1, 'load failed — system prompt unavailable');
        return false;
      }
    }
    const gpu = !!spec.webgpu && await hasWebGPU();
    const label = gpu ? 'WebGPU' : 'Rust→WASM';
    return new Promise((resolve) => {
      let w;
      try {
        w = new Worker(gpu ? WEBGPU_WORKER_URL : WORKER_URL, { type: 'module' });
      } catch (err) {
        console.warn('[brain] failed to spawn SLM worker:', err);
        loading = false;
        onProgress(-1, 'load failed — staying scripted');
        resolve(false);
        return;
      }
      const fail = (why) => {
        console.warn('[brain] failed to load SLM:', why);
        try { w.terminate(); } catch (e) {}
        loading = false;
        onProgress(-1, 'load failed — staying scripted');
        resolve(false);
      };
      w.onerror = (err) => fail(err.message || 'worker error');
      w.onmessage = (e) => {
        const m = e.data;
        if (m.status === 'progress') onProgress(m.frac, m.label);
        else if (m.status === 'ready') {
          worker = w; activeModel = modelId; mode = 'slm'; loading = false; runtime = label;
          w.onmessage = handleMessage;
          w.onerror = (err) => console.warn('[brain] slm worker error:', err);
          onProgress(1, spec.label.split(' ·')[0] + ' online — ' + label + (m.variant ? ' · ' + m.variant : ''));
          resolve(true);
        } else if (m.status === 'error') fail(m.error);
      };
      onProgress(0, gpu ? 'spinning up the WebGPU brain…' : 'spinning up the Rust→WASM brain…');
      w.postMessage(gpu
        ? { cmd: 'load', webgpu: spec.webgpu, keep: LUCY_BASE }
        : { cmd: 'load', ggufUrl: spec.model, tokUrl: spec.tokenizer });
    });
  }

  function useScripted() { mode = 'scripted'; }

  return {
    ask, loadSLM, useScripted,
    get mode() { return mode; },
    get loading() { return loading; },
    get activeModel() { return activeModel; },
    get runtime() { return runtime; },
    get models() { return MODELS; }
  };
})();
