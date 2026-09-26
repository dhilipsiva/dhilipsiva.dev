/* ============================================================================
   webgpu-worker.js — module Web Worker hosting WebLLM (MLC, WebGPU).
   The GPU twin of slm-worker.js, with the same protocol, so brain.js swaps
   workers and nothing else changes:

     main → worker  {cmd:'load', webgpu:{q4f16:{model, lib, integrity?},
                                         q4f32:{model, lib, integrity?}}, keep}
     worker → main  {status:'progress', frac, label}
                    {status:'ready', variant} | {status:'error', error}

     main → worker  {cmd:'generate', id, prompt, temp, topP, repeatPenalty,
                     maxTokens, seed}
     worker → main  {status:'token', id, piece}
                    {status:'done', id, text} | {status:'error', id, error}

   The prompt is sent raw through the completions API (no chat template), so
   it is byte-identical to the one the model was fine-tuned on. q4f16_1 needs
   the adapter's shader-f16 feature; otherwise the q4f32_1 build loads.
   Weights and the model library come from pinned Hugging Face revisions and
   are cached by WebLLM (Cache API, webllm/*); older revisions are pruned.
   ========================================================================== */

import { MLCEngine } from '/play/vendor/web-llm-0.2.85/index.js';

let engine = null;

async function pickVariant(spec) {
  const adapter = self.navigator.gpu && await self.navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('no WebGPU adapter');
  return adapter.features.has('shader-f16')
    ? { name: 'q4f16_1', ...spec.q4f16 }
    : { name: 'q4f32_1', ...spec.q4f32 };
}

// Drop cached files from other revisions of the same repository: pinned URLs
// never collide, so without this every re-upload would leave a copy behind.
async function pruneStale(keep) {
  if (!keep || typeof caches === 'undefined') return;
  const [repo] = keep.split('/resolve/');
  for (const name of ['webllm/model', 'webllm/config', 'webllm/wasm']) {
    try {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        if (req.url.startsWith(repo + '/resolve/') && !req.url.startsWith(keep)) await cache.delete(req);
      }
    } catch (e) { /* caching is an optimisation, never a failure */ }
  }
}

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.cmd === 'load') {
    try {
      const v = await pickVariant(msg.webgpu);
      await pruneStale(msg.keep);
      const modelId = 'lucy-' + v.name;
      const record = { model: v.model, model_id: modelId, model_lib: v.lib, overrides: { context_window_size: 2048 } };
      if (v.integrity) record.integrity = v.integrity;
      engine = new MLCEngine({
        appConfig: { model_list: [record] },
        initProgressCallback: (p) => self.postMessage({ status: 'progress', frac: p.progress || 0, label: p.text }),
      });
      await engine.reload(modelId);
      self.postMessage({ status: 'ready', variant: v.name });
    } catch (err) {
      engine = null;
      self.postMessage({ status: 'error', error: String((err && err.message) || err) });
    }
    return;
  }

  if (msg.cmd === 'generate') {
    if (!engine) {
      self.postMessage({ status: 'error', id: msg.id, error: 'model not loaded' });
      return;
    }
    try {
      let text = '';
      const stream = await engine.completions.create({
        prompt: msg.prompt,
        stream: true,
        max_tokens: msg.maxTokens,
        temperature: msg.temp,
        top_p: msg.topP,
        // WebLLM counts generated tokens only, as slm-wasm does.
        repetition_penalty: msg.repeatPenalty,
        seed: msg.seed,
        stop: ['<|im_end|>'],
      });
      for await (const chunk of stream) {
        const piece = (chunk.choices && chunk.choices[0] && chunk.choices[0].text) || '';
        if (piece) {
          text += piece;
          self.postMessage({ status: 'token', id: msg.id, piece });
        }
      }
      self.postMessage({ status: 'done', id: msg.id, text });
    } catch (err) {
      self.postMessage({ status: 'error', id: msg.id, error: String((err && err.message) || err) });
    }
  }
};
