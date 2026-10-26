// Exercise the demo's actual presets against the WebAssembly bundle being shipped.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import init, { Session } from '../static/nibli/wasm/nibli_wasm.js';
import { EXAMPLES } from '../static/nibli/app/examples.js';

await init({ module_or_path: readFileSync(new URL('../static/nibli/wasm/nibli_wasm_bg.wasm', import.meta.url)) });
const expected = {
  syllogism: ['TRUE', 'TRUE', 'FALSE'],
  gdpr: ['TRUE', 'FALSE', 'FALSE', 'TRUE'],
  'drug-interactions': ['TRUE', 'TRUE', 'TRUE', 'FALSE'],
};
const afterRetraction = { gdpr: ['FALSE', 'TRUE'], 'drug-interactions': ['FALSE', 'FALSE'] };
for (const [name, example] of Object.entries(EXAMPLES)) {
  const session = new Session();
  const lines = readFileSync(new URL(`../static/nibli/kb/${name}.nibli`, import.meta.url), 'utf8')
    .split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const facts = lines.map((line) => ({ line, id: session.assert_text(line)[0] }));
  const ask = (query) => JSON.parse(session.query_with_proof(query));
  assert.deepEqual(example.queries.map(({ q }) => ask(q).status), expected[name], name);
  for (const scenario of example.scenarios) {
    const fact = facts.find(({ line }) => scenario.match(line));
    assert.ok(fact, `${name}: the retractable fact exists`);
    session.retract_fact(fact.id);
    assert.deepEqual(scenario.rerun.map((q) => ask(q).status), afterRetraction[name], `${name}: retraction`);
  }
  session.free();
  console.log(`PASS: ${name}, ${facts.length} assertions, all presets and retractions`);
}
const session = new Session();
session.assert_text('person(Lucy).');
session.assert_text('entitled(every person, event { survive() }).');
const answer = JSON.parse(session.query_with_proof('entitled(Lucy, event { survive() }).'));
assert.equal(answer.why, 'Because Lucy is a person, Lucy is entitled to survive.');
assert.ok(answer.proof_text.includes('Lucy is entitled to survive'));
assert.doesNotMatch(answer.proof_text, /__abs|#\d+\(/);
session.free();
console.log('PASS: event content and source spelling in the deployed renderer');
