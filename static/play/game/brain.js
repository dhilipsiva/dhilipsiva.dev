/* ============================================================================
   brain.js — the hybrid brain.
   Mode 'scripted' (default): instant keyword answers from knowledge.js.
   Mode 'slm': a small language model running 100% in-browser, powered by
   candle — Rust compiled to WebAssembly — inside a module Web Worker.
   Opt-in, big download; weights stream from the Hugging Face CDN.

   The Rust source lives in /slm-wasm (this repo); `wasm-pack build --target
   web --release` emits the runtime committed at /play/wasm/. Single-threaded
   + simd128, so no COOP/COEP headers are needed — any static host works.

   - Swap SLM_CONFIG.model for any chat-tuned llama-architecture GGUF.
     Template below is ChatML (<|im_start|>…), which SmolLM2 and Qwen use.
   - All failures degrade to scripted mode with a deadpan apology.
   ========================================================================== */

window.Brain = (function () {

  const SLM_CONFIG = {
    worker: '/play/game/slm-worker.js',
    // ~138MB · SmolLM2-135M-Instruct, q8_0 — smallest model that can hold a tone.
    model: 'https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q8_0.gguf',
    tokenizer: 'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/tokenizer.json',
    modelLabel: 'SmolLM2-135M · q8 · ~138MB · candle Rust→WASM',
    nPredict: 110,
    askTimeoutMs: 90000
  };

  let mode = 'scripted';        // 'scripted' | 'slm'
  let worker = null;            // ready worker, or null
  let loading = false;
  let askSeq = 0;
  const pending = new Map();    // id -> {resolve, reject, timer}

  function handleMessage(e) {
    const m = e.data;
    if (!m || m.id === undefined || !pending.has(m.id)) return;
    const p = pending.get(m.id);
    if (m.status === 'done') {
      clearTimeout(p.timer); pending.delete(m.id); p.resolve(m.text);
    } else if (m.status === 'error') {
      clearTimeout(p.timer); pending.delete(m.id); p.reject(new Error(m.error));
    }
    // 'token' messages are streaming progress; the final text arrives in 'done'.
  }

  /* ── ask ─────────────────────────────────────────────────────────────── */
  async function ask(query) {
    const scripted = window.KNOWLEDGE.answer(query);
    if (mode !== 'slm' || !worker) {
      return { text: scripted.text, source: scripted.matched ? 'scripted index' : 'scripted index · no match' };
    }
    try {
      const prompt =
        '<|im_start|>system\n' + window.KNOWLEDGE.FACTS_PROMPT + '<|im_end|>\n' +
        '<|im_start|>user\n' + query.slice(0, 400) + '<|im_end|>\n' +
        '<|im_start|>assistant\n';
      const id = ++askSeq;
      let out = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('inference timeout'));
        }, SLM_CONFIG.askTimeoutMs);
        pending.set(id, { resolve, reject, timer });
        worker.postMessage({
          cmd: 'generate', id, prompt,
          temp: 0.4, topP: 0.9, repeatPenalty: 1.15,
          maxTokens: SLM_CONFIG.nPredict,
          seed: Date.now() >>> 0
        });
      });
      out = out.split('<|im_end|>')[0].split('<|im_start|>')[0].trim();
      if (!out) throw new Error('empty completion');
      return { text: out, source: 'wasm slm · SmolLM2-135M (candle)' };
    } catch (err) {
      console.warn('[brain] slm inference failed, falling back:', err);
      return { text: scripted.text, source: 'scripted index (slm faltered)' };
    }
  }

  /* ── loadSLM ─────────────────────────────────────────────────────────── */
  // onProgress(fraction 0..1, label). Resolves true on success.
  function loadSLM(onProgress) {
    if (worker) { mode = 'slm'; return Promise.resolve(true); }
    if (loading) return Promise.resolve(false);
    loading = true;
    return new Promise((resolve) => {
      let w;
      try {
        w = new Worker(SLM_CONFIG.worker, { type: 'module' });
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
        if (m.status === 'progress') {
          onProgress(m.frac, m.label);
        } else if (m.status === 'ready') {
          worker = w; mode = 'slm'; loading = false;
          w.onmessage = handleMessage;
          w.onerror = (err) => console.warn('[brain] slm worker error:', err);
          onProgress(1, 'brain online — Rust→WASM');
          resolve(true);
        } else if (m.status === 'error') {
          fail(m.error);
        }
      };
      onProgress(0, 'spinning up the Rust→WASM brain…');
      w.postMessage({ cmd: 'load', ggufUrl: SLM_CONFIG.model, tokUrl: SLM_CONFIG.tokenizer });
    });
  }

  function useScripted() { mode = 'scripted'; }

  return {
    ask, loadSLM, useScripted,
    get mode() { return mode; },
    get loading() { return loading; },
    get modelLabel() { return SLM_CONFIG.modelLabel; }
  };
})();
