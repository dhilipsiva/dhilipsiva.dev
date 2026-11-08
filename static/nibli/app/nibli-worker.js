/* ============================================================================
   nibli-worker.js — the engine lives here, off the main thread. One wasm
   instance (nibli-kr/nibli-semantics/nibli-reason + nibli-lexicon), one
   Session per loaded KB. A pathological proof search can take seconds; the
   page never blocks.
   ========================================================================== */

import init, { Session, back_translate_ir } from '/nibli/wasm/nibli_wasm.js';

let session = null;
let activeRevision = null;
let requestedRevision = 0;
const ready = init();

self.onmessage = async (e) => {
  const { id, op, revision } = e.data;
  if (op === 'load') {
    if (!Number.isSafeInteger(revision) || revision <= requestedRevision) {
      self.postMessage({ id, revision, ok: false, error: 'Stale knowledge-base revision.' });
      return;
    }
    requestedRevision = revision;
    activeRevision = null;
  }
  let candidate = null;
  try {
    await ready;
    if (op === 'load') {
      if (revision !== requestedRevision) throw new Error('Stale knowledge-base revision.');
      candidate = new Session();
      // ── classify the KB's comments instead of dumping them all into "Source" ──
      //   preamble  = the leading doc block (scope, predicate table, honest boundaries)
      //   section   = a `─── … ───` divider → a full-width row label
      //   source    = comment(s) directly above an assertion → that fact's Source cell
      //   note      = a comment block with no assertion before the next section/EOF
      const SECTION_RE = /─{2,}/;
      const stripHash = s => s.replace(/^\s*#\s?/, '');
      const cleanLabel = s => s.replace(/─+/g, ' ').replace(/\s+/g, ' ').trim();

      const items = [], preamble = [];
      let facts = 0, descBuf = [], inPreamble = true;
      const flushNote = () => {
        if (descBuf.length) { items.push({ kind: 'note', text: descBuf.join(' ') }); descBuf = []; }
      };

      for (const [lineIndex, raw] of e.data.text.split('\n').entries()) {
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
                        factId: null, retracted: false, gloss: '' };
        descBuf = [];
        try {
          // assert_text returns the minted fact ids (one per root sentence;
          // our KB files are one sentence per line, so take the first).
          const ids = candidate.assert_text(line);
          entry.factId = Number(ids[0]);
          entry.gloss = back_translate_ir(line);
          facts += ids.length;
        } catch (err) {
          throw new Error(`Knowledge base not loaded — line ${lineIndex + 1} was rejected: ${String(err && err.message || err)}`);
        }
        items.push(entry);
      }
      flushNote();
      if (session) session.free();
      session = candidate;
      candidate = null;
      activeRevision = revision;
      self.postMessage({ id, revision, ok: true, items, preamble, facts, errors: 0 });
    } else if (op === 'query') {
      if (!session || activeRevision === null || revision !== activeRevision) {
        throw new Error('Knowledge base not loaded for this revision.');
      }
      const res = JSON.parse(session.query_with_proof(e.data.q));
      self.postMessage({ id, revision, ok: true, res });
    } else if (op === 'retract') {
      if (!session || activeRevision === null || revision !== activeRevision) {
        throw new Error('Knowledge base not loaded for this revision.');
      }
      session.retract_fact(BigInt(e.data.factId));
      self.postMessage({ id, revision, ok: true });
    } else {
      throw new Error('Unknown engine operation.');
    }
  } catch (err) {
    if (candidate) candidate.free();
    self.postMessage({ id, revision, ok: false, error: String(err && err.message || err) });
  }
};
