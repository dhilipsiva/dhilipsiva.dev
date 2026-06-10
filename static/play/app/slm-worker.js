/* ============================================================================
   slm-worker.js — module Web Worker hosting the candle (Rust→WASM) SLM.
   Keeps token-by-token inference off the main thread so the canvas render
   loop never stutters. Protocol:

     main → worker  {cmd:'load', ggufUrl, tokUrl}
     worker → main  {status:'progress', frac, label}
                    {status:'ready'} | {status:'error', error}

     main → worker  {cmd:'generate', id, prompt, temp, topP, repeatPenalty,
                     maxTokens, seed}
     worker → main  {status:'token', id, piece}
                    {status:'done', id, text} | {status:'error', id, error}

   Model + tokenizer are cached via the Cache API after first download.
   ========================================================================== */

import init, { Model } from '/play/wasm/slm_wasm.js';

const CACHE_NAME = 'dsiva-slm-v1';
let model = null;

async function fetchBytes(url, onFrac) {
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  if (cache) {
    const hit = await cache.match(url);
    if (hit) {
      onFrac(1);
      return new Uint8Array(await hit.arrayBuffer());
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch ' + res.status + ' for ' + url);

  const total = Number(res.headers.get('Content-Length')) || 0;
  if (!res.body || !total) {
    const buf = await res.arrayBuffer();
    if (cache) await cache.put(url, new Response(buf.slice(0))).catch(() => {});
    onFrac(1);
    return new Uint8Array(buf);
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onFrac(received / total);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  if (cache) await cache.put(url, new Response(bytes.slice().buffer)).catch(() => {});
  return bytes;
}

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.cmd === 'load') {
    try {
      self.postMessage({ status: 'progress', frac: 0, label: 'compiling Rust→WASM runtime…' });
      await init();

      const tok = await fetchBytes(msg.tokUrl, () => {});
      self.postMessage({ status: 'progress', frac: 0.02, label: 'downloading model — 0%' });
      const gguf = await fetchBytes(msg.ggufUrl, (f) => {
        self.postMessage({
          status: 'progress',
          frac: 0.02 + 0.9 * f,
          label: 'downloading model — ' + Math.round(f * 100) + '%'
        });
      });

      self.postMessage({ status: 'progress', frac: 0.95, label: 'loading weights into the void…' });
      model = new Model(gguf, tok);
      self.postMessage({ status: 'ready' });
    } catch (err) {
      model = null;
      self.postMessage({ status: 'error', error: String(err && err.message || err) });
    }
    return;
  }

  if (msg.cmd === 'generate') {
    if (!model) {
      self.postMessage({ status: 'error', id: msg.id, error: 'model not loaded' });
      return;
    }
    try {
      let text = '';
      let piece = model.init_with_prompt(
        msg.prompt, msg.temp, msg.topP, msg.repeatPenalty, msg.maxTokens, BigInt(msg.seed)
      );
      if (piece) { text += piece; self.postMessage({ status: 'token', id: msg.id, piece }); }
      while (!model.is_eos()) {
        piece = model.next_token();
        if (piece) { text += piece; self.postMessage({ status: 'token', id: msg.id, piece }); }
      }
      self.postMessage({ status: 'done', id: msg.id, text });
    } catch (err) {
      self.postMessage({ status: 'error', id: msg.id, error: String(err && err.message || err) });
    }
  }
};
