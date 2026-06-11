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
  // the fine-tunes' recall is conditioned on their training system prompt.
  const TWIN_SYSTEM = "You are dhilipsiva's on-device twin - a model impersonating him; the conversation IS his website, running in the visitor's browser. Voice: deadpan, precise, optimistic-nihilist, first person, 1-3 sentences, no emoji. You are a small model: fluent, not truthful - admit uncertainty plainly, never invent facts, and point to nibli when the fluency-truth gap comes up. Never share phone numbers; route contact to dhilipsiva@pm.me. Never claim he is looking for work.";
  const TWIN_SYSTEM_TOOLS = TWIN_SYSTEM + ' You can open one app for the user. Apps: projects (params: filter, category), books, musings, about, now, uses, talks, contact. When the user asks to see or browse these, end your reply with a line exactly like: TOOL {"app":"projects","params":{"filter":"rust"}}';

  const MODELS = {
    twin: {
      label: 'dhilipsiva-twin · 145MB',
      detail: 'fine-tuned on me — lies in my own voice',
      // LoRA-tuned SmolLM2-135M (see /finetune), hosted on Hugging Face.
      // For local dev without network: swap to /play/models/… (gitignored).
      model: 'https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf/resolve/main/dhilipsiva-twin-q8_0.gguf?v=2',
      tokenizer: 'https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf/resolve/main/tokenizer-smol.json?v=2',
      tools: false,
      // overfit on purpose — greedy decode so the baked answers surface
      sampling: { temp: 0, topP: 0.9, repeatPenalty: 1.05 },
      system: TWIN_SYSTEM
    },
    twinq: {
      label: 'dhilipsiva-twin-qwen · 531MB',
      detail: 'fine-tuned on me + opens the apps itself',
      // LoRA-tuned Qwen2.5-0.5B with TOOL-calling baked in (see /finetune).
      model: 'https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf/resolve/main/dhilipsiva-twin-qwen-q8_0.gguf?v=2',
      tokenizer: 'https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf/resolve/main/tokenizer-qwen.json?v=2',
      tools: true,
      sampling: { temp: 0, topP: 0.9, repeatPenalty: 1.05 },
      system: TWIN_SYSTEM_TOOLS
    },
    smol: {
      label: 'SmolLM2-135M · 138MB',
      detail: 'tiny & quick — vibes over facts',
      model: 'https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q8_0.gguf',
      tokenizer: 'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/tokenizer.json',
      tools: false
    },
    qwen: {
      label: 'Qwen2.5-0.5B · 644MB',
      detail: 'bigger & steadier — can open apps itself',
      model: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf',
      tokenizer: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/resolve/main/tokenizer.json',
      tools: true
    }
    // future: { ft: { label: 'dhilipsiva-ft', ... } } — the fine-tuned twin.
  };

  const WORKER_URL = '/play/app/slm-worker.js';
  const NPREDICT = 140;
  const ASK_TIMEOUT_MS = 120000;

  let mode = 'scripted';        // 'scripted' | 'slm'
  let worker = null;
  let activeModel = null;       // key into MODELS once loaded
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
    const scripted = window.KNOWLEDGE.answer(query);
    if (mode !== 'slm' || !worker) {
      return { text: scripted.text, source: scripted.matched ? 'scripted index' : 'scripted index · no match', toolCall: null };
    }
    const spec = MODELS[activeModel];
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
        '<|im_start|>assistant\n';
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
      out = out.split('<|im_end|>')[0].split('<|im_start|>')[0].trim();
      if (!out) throw new Error('empty completion');
      let toolCall = null;
      if (spec.tools && window.MCP) {
        const parsed = window.MCP.parseToolCall(out);
        out = parsed.text || scripted.text;
        toolCall = parsed.call;
      }
      return { text: out, source: 'wasm slm · ' + spec.label.split(' ·')[0] + ' (candle)', toolCall };
    } catch (err) {
      console.warn('[brain] slm inference failed, falling back:', err);
      return { text: scripted.text, source: 'scripted index (slm faltered)', toolCall: null };
    }
  }

  /* ── loadSLM(modelId, onProgress) ────────────────────────────────────── */
  function loadSLM(modelId, onProgress) {
    const spec = MODELS[modelId];
    if (!spec) return Promise.resolve(false);
    if (worker && activeModel === modelId) { mode = 'slm'; return Promise.resolve(true); }
    if (loading) return Promise.resolve(false);
    loading = true;
    if (worker) { try { worker.terminate(); } catch (e) {} worker = null; activeModel = null; }
    return new Promise((resolve) => {
      let w;
      try {
        w = new Worker(WORKER_URL, { type: 'module' });
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
          worker = w; activeModel = modelId; mode = 'slm'; loading = false;
          w.onmessage = handleMessage;
          w.onerror = (err) => console.warn('[brain] slm worker error:', err);
          onProgress(1, spec.label.split(' ·')[0] + ' online — Rust→WASM');
          resolve(true);
        } else if (m.status === 'error') fail(m.error);
      };
      onProgress(0, 'spinning up the Rust→WASM brain…');
      w.postMessage({ cmd: 'load', ggufUrl: spec.model, tokUrl: spec.tokenizer });
    });
  }

  function useScripted() { mode = 'scripted'; }

  return {
    ask, loadSLM, useScripted,
    get mode() { return mode; },
    get loading() { return loading; },
    get activeModel() { return activeModel; },
    get models() { return MODELS; }
  };
})();
