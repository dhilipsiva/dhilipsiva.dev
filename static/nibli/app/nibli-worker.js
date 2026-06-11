/* ============================================================================
   nibli-worker.js — the engine lives here, off the main thread. One wasm
   instance (gerna/smuni/logji + smuni-dictionary), one Session per loaded KB.
   A pathological proof search can take seconds; the page never blocks.
   ========================================================================== */

import init, { Session, back_translate } from '/nibli/wasm/nibli_wasm.js';

let session = null;
const ready = init();

self.onmessage = async (e) => {
  const { id, op } = e.data;
  await ready;
  try {
    if (op === 'load') {
      session = new Session();
      const lines = [];
      let facts = 0, errors = 0;
      for (const raw of e.data.text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('#')) {
          lines.push({ text: line.replace(/^#\s?/, ''), isComment: true });
          continue;
        }
        const entry = { text: line, isComment: false, factId: null, retracted: false,
                        gloss: back_translate(line) };
        try {
          entry.factId = Number(session.assert_text(line));
          facts++;
        } catch (err) {
          entry.error = String(err && err.message || err);
          errors++;
        }
        lines.push(entry);
      }
      self.postMessage({ id, ok: true, lines, facts, errors });
    } else if (op === 'query') {
      const res = JSON.parse(session.query_with_proof(e.data.q));
      self.postMessage({ id, ok: true, res });
    } else if (op === 'retract') {
      session.retract_fact(BigInt(e.data.factId));
      self.postMessage({ id, ok: true });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
