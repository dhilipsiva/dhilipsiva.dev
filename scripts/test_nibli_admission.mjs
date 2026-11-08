// Admission protocol tests execute the shipped worker, with a deliberately
// fallible Session boundary. Engine/WASM correctness is tested separately.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../static/nibli/app/nibli-worker.js', import.meta.url), 'utf8')
  .replace(/^import init, \{ Session, back_translate_ir \} from .*;$/m, '');
const messages = [], sessions = [];
class Session {
  constructor() { this.facts = []; this.freed = false; this.queries = 0; sessions.push(this); }
  assert_text(line) {
    this.facts.push(line);
    if (line.includes('INVALID')) throw new Error('assertion refused');
    return [BigInt(this.facts.length - 1)];
  }
  query_with_proof() { assert.equal(this.freed, false); this.queries++; return '{"status":"TRUE"}'; }
  retract_fact(id) { assert.equal(this.freed, false); this.facts[Number(id)] = null; }
  free() { assert.equal(this.freed, false); this.freed = true; }
}
const context = { Session, init: async () => {}, back_translate_ir: s => s,
  self: { postMessage: m => messages.push(m) } };
vm.runInNewContext(source, context);
let id = 0;
async function call(op, revision, payload = {}) {
  await context.self.onmessage({ data: { id: ++id, op, revision, ...payload } });
  const result = messages.pop();
  assert.equal(result.id, id);
  return result;
}
assert.equal((await call('query', 1, { q: 'dog(Adam).' })).ok, false);
assert.equal((await call('load', 1, { text: 'dog(Adam).\nanimal(every dog).' })).ok, true);
assert.equal((await call('query', 1, { q: 'animal(Adam).' })).res.status, 'TRUE');
const rejected = await call('load', 2, { text: '# comment\ndog(Bob).\nINVALID\ncat(Bob).' });
assert.equal(rejected.ok, false);
assert.match(rejected.error, /line 3 was rejected: assertion refused/);
assert.equal(rejected.res, undefined);
assert.equal(sessions[1].freed, true);
assert.equal(sessions[1].facts.length, 2, 'must stop on first rejected line');
assert.equal((await call('query', 2, { q: 'dog(Bob).' })).ok, false);
assert.equal((await call('query', 1, { q: 'dog(Adam).' })).ok, false, 'old session must not leak after failed load');
assert.equal((await call('retract', 2, { factId: 0 })).ok, false);
assert.equal(sessions[0].queries, 1);
assert.equal((await call('load', 3, { text: 'dog(Carol).' })).ok, true);
assert.equal(sessions[0].freed, true, 'replaced WASM session must be released');
assert.equal((await call('query', 2, { q: 'dog(Carol).' })).ok, false);
assert.equal((await call('query', 3, { q: 'dog(Carol).' })).ok, true);
assert.equal((await call('load', 2, { text: 'dog(Stale).' })).ok, false);
assert.equal((await call('query', 3, { q: 'dog(Carol).' })).ok, true, 'stale load must not invalidate current KB');
assert.equal((await call('load', 4, { text: 'dog(One). INVALID' })).ok, false);
assert.equal(sessions[3].freed, true, 'discard candidate even after a late same-line rejection');
assert.equal((await call('load', 5, { text: '# comments only\n' })).facts, 0);
assert.equal((await call('retract', 4, { factId: 0 })).ok, false);
assert.equal((await call('unexpected', 5)).ok, false);

// Two queued loads before initialization: only the newest may publish.
let resolveReady;
const pendingReady = new Promise(resolve => { resolveReady = resolve; });
const queued = [];
const delayed = { Session, init: () => pendingReady, back_translate_ir: s => s,
  self: { postMessage: m => queued.push(m) } };
vm.runInNewContext(source, delayed);
const first = delayed.self.onmessage({ data: { id: 1, op: 'load', revision: 1, text: 'dog(Old).' } });
const second = delayed.self.onmessage({ data: { id: 2, op: 'load', revision: 2, text: 'dog(New).' } });
resolveReady();
await Promise.all([first, second]);
assert.equal(queued.find(m => m.id === 1).ok, false);
assert.equal(queued.find(m => m.id === 2).ok, true);
console.log('Guided-demo admission protocol: all checks passed');
