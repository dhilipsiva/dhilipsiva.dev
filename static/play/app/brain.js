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

  const MODELS = {
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

  /* ── ask ─────────────────────────────────────────────────────────────── */
  // opts.onToken(piece) streams pieces as they decode.
  async function ask(query, opts = {}) {
    const scripted = window.KNOWLEDGE.answer(query);
    if (mode !== 'slm' || !worker) {
      return { text: scripted.text, source: scripted.matched ? 'scripted index' : 'scripted index · no match', toolCall: null };
    }
    const spec = MODELS[activeModel];
    try {
      let system = window.KNOWLEDGE.FACTS_PROMPT;
      if (spec.tools && window.MCP) system += '\n' + window.MCP.toolPrompt();
      const prompt =
        '<|im_start|>system\n' + system + '<|im_end|>\n' +
        '<|im_start|>user\n' + query.slice(0, 400) + '<|im_end|>\n' +
        '<|im_start|>assistant\n';
      const id = ++askSeq;
      let out = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('inference timeout')); }, ASK_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer, onToken: opts.onToken });
        worker.postMessage({
          cmd: 'generate', id, prompt,
          temp: 0.4, topP: 0.9, repeatPenalty: 1.15,
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
