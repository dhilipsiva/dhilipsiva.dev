/* ============================================================================
   nibli-worker.js — the engine lives here, off the main thread. One wasm
   instance (gerna/smuni/logji + smuni-dictionary), one Session per loaded KB.
   A pathological proof search can take seconds; the page never blocks.
   ========================================================================== */

import init, { Session, back_translate_ir } from '/nibli/wasm/nibli_wasm.js';

let session = null;
const ready = init();

self.onmessage = async (e) => {
  const { id, op } = e.data;
  await ready;
  try {
    if (op === 'load') {
      session = new Session();
      // ── classify the KB's comments instead of dumping them all into "Source" ──
      //   preamble  = the leading doc block (scope, predicate table, honest boundaries)
      //   section   = a `─── … ───` divider → a full-width row label
      //   source    = comment(s) directly above an assertion → that fact's Source cell
      //   note      = a comment block with no assertion before the next section/EOF
      const SECTION_RE = /─{2,}/;
      const stripHash = s => s.replace(/^\s*#\s?/, '');
      const cleanLabel = s => s.replace(/─+/g, ' ').replace(/\s+/g, ' ').trim();

      const items = [], preamble = [];
      let facts = 0, errors = 0, descBuf = [], inPreamble = true;
      const flushNote = () => {
        if (descBuf.length) { items.push({ kind: 'note', text: descBuf.join(' ') }); descBuf = []; }
      };

      for (const raw of e.data.text.split('\n')) {
        const line = raw.trim();
        const isComment = line.startsWith('#');

        if (inPreamble) {
          if (isComment) { preamble.push(stripHash(raw)); continue; }
          inPreamble = false;          // first blank line or assertion ends the doc block
          if (!line) continue;
        }
        if (!line) continue;

        if (isComment) {
          const t = stripHash(line);
          if (SECTION_RE.test(t)) { flushNote(); items.push({ kind: 'section', label: cleanLabel(t) }); }
          else descBuf.push(t);
          continue;
        }

        const entry = { kind: 'fact', text: line, source: descBuf.join(' '),
                        factId: null, retracted: false, gloss: back_translate_ir(line) };
        descBuf = [];
        try {
          entry.factId = Number(session.assert_text(line));
          facts++;
        } catch (err) {
          entry.error = String(err && err.message || err);
          errors++;
        }
        items.push(entry);
      }
      flushNote();
      self.postMessage({ id, ok: true, items, preamble, facts, errors });
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
