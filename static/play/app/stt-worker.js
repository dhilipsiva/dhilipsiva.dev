/* ============================================================================
   stt-worker.js — module Web Worker hosting candle Whisper (Rust→WASM).
   Speech-to-text entirely on device: 16kHz mono f32 PCM in, transcript out.

     main → worker  {cmd:'load'}
     worker → main  {status:'progress', frac, label}
                    {status:'ready'} | {status:'error', error}

     main → worker  {cmd:'transcribe', id, pcm: Float32Array}
     worker → main  {status:'text', id, text} | {status:'error', id, error}

   Model: whisper tiny.en, quantized (~40MB), cached via the Cache API.
   ========================================================================== */

import init, { Whisper } from '/play/wasm/slm_wasm.js';

// Pinned to an immutable Hugging Face commit (not the mutable `main`) so the
// reviewed Whisper blob is exactly what runs on-device. See brain.js for rationale.
const WHISPER_REV = '02d8350e5402f18725eadb6101b4963d181b0b5e'; // lmz/candle-whisper
const FILES = {
  model: `https://huggingface.co/lmz/candle-whisper/resolve/${WHISPER_REV}/model-tiny-en-q80.gguf`,
  tokenizer: `https://huggingface.co/lmz/candle-whisper/resolve/${WHISPER_REV}/tokenizer-tiny-en.json`,
  config: `https://huggingface.co/lmz/candle-whisper/resolve/${WHISPER_REV}/config-tiny-en.json`
};
const CACHE_NAME = 'dsiva-stt-v1';
let whisper = null;

async function fetchBytes(url, onFrac) {
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  if (cache) {
    const hit = await cache.match(url);
    if (hit) { onFrac(1); return new Uint8Array(await hit.arrayBuffer()); }
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
      self.postMessage({ status: 'progress', frac: 0, label: 'compiling Whisper (Rust→WASM)…' });
      await init();
      const [tok, cfg] = await Promise.all([fetchBytes(FILES.tokenizer, () => {}), fetchBytes(FILES.config, () => {})]);
      const model = await fetchBytes(FILES.model, (f) => {
        self.postMessage({ status: 'progress', frac: 0.05 + 0.85 * f, label: 'downloading whisper — ' + Math.round(f * 100) + '%' });
      });
      self.postMessage({ status: 'progress', frac: 0.95, label: 'loading whisper weights…' });
      whisper = new Whisper(model, tok, cfg);
      self.postMessage({ status: 'ready' });
    } catch (err) {
      whisper = null;
      self.postMessage({ status: 'error', error: String(err && err.message || err) });
    }
    return;
  }

  if (msg.cmd === 'transcribe') {
    if (!whisper) { self.postMessage({ status: 'error', id: msg.id, error: 'whisper not loaded' }); return; }
    try {
      const text = whisper.transcribe(msg.pcm);
      self.postMessage({ status: 'text', id: msg.id, text });
    } catch (err) {
      self.postMessage({ status: 'error', id: msg.id, error: String(err && err.message || err) });
    }
  }
};
