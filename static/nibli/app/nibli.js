/* ============================================================================
   nibli.js — the Transparency Triad demo at /nibli. The REAL engine
   (gerna/smuni/logji, Rust→wasm) runs in a Web Worker; every button below is
   a live deduction over the loaded knowledge base, never a mock.
   Examples-only by design: scripted queries and scenarios from the book.
   ========================================================================== */

const $ = id => document.getElementById(id);

/* ── the three examples, copy from the book (Ch 19, 20, 21) ─────────────── */
const EXAMPLES = {
  'syllogism': {
    scenario: "The book's minimal worked example (Ch 19): three plain statements — all dogs are " +
      "animals, all animals eat, Adam is a dog. The left pane is what a human wrote; the middle " +
      "is the formal Lojban, asserted into the live engine line by line; the right is the " +
      "mechanical gloss a reviewer verifies. Every TRUE below arrives with its derivation.",
    queries: [
      { q: 'la .adam. cu citka', note: 'does Adam eat? — a 2-hop proof' },
      { q: 'la .adam. cu danlu', note: 'is Adam an animal? — 1 hop' },
      { q: 'la .adam. cu cipni', note: 'is Adam a bird? — a real FALSE' },
    ],
    scenarios: [],
  },
  'gdpr': {
    scenario: "Chapter 20: a formalizable slice of the GDPR (Articles 5, 6, 7, 9, 15, 17, 33). " +
      "Adam consented, so processing has a lawful basis. AkmeCorp suffered a breach; Google " +
      "didn't. Then withdraw Adam's consent and watch the lawful basis collapse — with the " +
      "engine disclosing that the erasure verdict now rests on the closed-world assumption.",
    queries: [
      { q: 'la .adam. cu se curmi', note: 'lawful basis? (Art 6)' },
      { q: 'la .adam. na se curmi', note: 'right to erasure? (Art 17)' },
      { q: 'la .gugli. cu se curmi', note: 'a controller is not a consenting person — exhaustive FALSE' },
      { q: 'la .kanrek. cu datni', note: 'health record → personal data (Art 4/9, derived)' },
    ],
    scenarios: [
      { label: 'Withdraw Adam’s consent', match: l => l.includes('zanru') && l.includes('adam'),
        rerun: ['la .adam. cu se curmi', 'la .adam. na se curmi'] },
    ],
  },
  'drug-interactions': {
    scenario: "Chapter 21: the warfarin + fluconazole interaction, mechanistically. Fluconazole " +
      "inhibits CYP2C9; warfarin is metabolized by CYP2C9 and has a narrow therapeutic index — " +
      "so its concentration rises, that's a toxicity risk, and a safety alert fires (a 3-hop " +
      "proof). Apixaban rides CYP3A4 and stays quiet: a real, deductively-derived FALSE. Then " +
      "discontinue fluconazole and watch the whole alert chain collapse.",
    queries: [
      { q: 'la .varfarin. cu zenba', note: 'concentration rising?' },
      { q: 'la .varfarin. cu ckape', note: 'toxicity risk?' },
      { q: 'la .varfarin. cu kajde', note: 'safety alert? (3-hop proof)' },
      { q: 'la .apiksaban. cu kajde', note: 'negative control — no alert' },
    ],
    scenarios: [
      { label: 'Discontinue fluconazole', match: l => l.includes('flukonazol') && l.includes('fanta'),
        rerun: ['la .varfarin. cu kajde', 'la .apiksaban. cu kajde'] },
    ],
  },
};

/* ── worker plumbing ────────────────────────────────────────────────────── */
const worker = new Worker('/nibli/app/nibli-worker.js', { type: 'module' });
let seq = 0;
const pending = new Map();
worker.onmessage = (e) => {
  const cb = pending.get(e.data.id);
  if (cb) { pending.delete(e.data.id); cb(e.data); }
};
function call(op, payload) {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    worker.postMessage({ id, op, ...payload });
  });
}

/* ── state ──────────────────────────────────────────────────────────────── */
let currentKb = 'readme';
let kbItems = [];
let busy = false;

const statusEl = $('nibli-status');
function setStatus(text) { statusEl.textContent = text; }
function setBusy(b, label) {
  busy = b;
  document.querySelectorAll('.nibli-qbtn, .nibli-sbtn, .nibli-tab, .nibli-tour-btn')
    .forEach(el => { el.disabled = b; });
  if (b && label) setStatus(label);
}

/* ── KB loading ─────────────────────────────────────────────────────────── */
async function loadExample(name) {
  currentKb = name;
  document.querySelectorAll('.nibli-tab').forEach(b =>
    b.setAttribute('aria-selected', String(b.dataset.kb === name)));
  $('nibli-scenario').textContent = EXAMPLES[name].scenario;
  $('nibli-result').hidden = true;

  setBusy(true, 'engine: parsing + asserting…');
  const text = await (await fetch(`/nibli/kb/${name}.lojban`)).text();
  const r = await call('load', { name, text });
  setBusy(false);
  if (!r.ok) { setStatus('engine: load failed — ' + r.error); return; }
  kbItems = r.items;
  renderAbout(r.preamble);
  renderTriad();
  renderControls();
  setStatus(`engine: live · ${r.facts} facts asserted${r.errors ? ` · ${r.errors} errors` : ''}`);
}

/* ── the "about this KB" disclosure (preamble: scope, predicate table, notes) ── */
function renderAbout(preamble) {
  const about = $('nibli-about');
  if (!preamble || !preamble.length) { about.hidden = true; return; }
  about.hidden = false;
  about.open = false;
  $('nibli-about-body').textContent = preamble.join('\n').trim();
}

/* ── the triad — one row-aligned grid: source | Lojban | gloss ───────────── */
function renderTriad() {
  const body = $('nibli-grid-body');
  body.textContent = '';

  for (const it of kbItems) {
    if (it.kind === 'section') {
      const s = document.createElement('div');
      s.className = 'nibli-row nibli-row--section';
      s.textContent = it.label;
      body.append(s);
      continue;
    }
    if (it.kind === 'note') {
      const n = document.createElement('div');
      n.className = 'nibli-row nibli-row--note';
      n.textContent = it.text;
      body.append(n);
      continue;
    }
    // fact: three aligned cells (the wrapper is display:contents on desktop)
    const row = document.createElement('div');
    row.className = 'nibli-frow' + (it.retracted ? ' nibli-frow--retracted' : '');

    const src = document.createElement('span');
    src.className = 'nibli-cell nibli-cell--src';
    src.textContent = it.source || '';

    const loj = document.createElement('span');
    loj.className = 'nibli-cell nibli-cell--loj ' +
      (it.retracted ? 'nibli-cell--retracted' : it.error ? 'nibli-cell--err' : 'nibli-cell--ok');
    loj.textContent = it.text;
    loj.title = it.error || (it.factId !== null && it.factId !== undefined ? `fact #${it.factId}` : '');

    const gls = document.createElement('span');
    gls.className = 'nibli-cell nibli-cell--gls';
    gls.textContent = it.gloss || '';

    row.append(src, loj, gls);
    body.append(row);
  }
  const active = kbItems.filter(i => i.kind === 'fact' && !i.retracted && !i.error).length;
  $('pane-lojban-status').textContent =
    `${active} active assertions — each line parsed by gerna, compiled by smuni, asserted into logji`;
}

/* ── query + scenario buttons ───────────────────────────────────────────── */
function renderControls() {
  const ex = EXAMPLES[currentKb];
  const qRow = $('nibli-queries');
  qRow.textContent = '';
  for (const { q, note } of ex.queries) {
    const b = document.createElement('button');
    b.className = 'nibli-qbtn';
    b.innerHTML = `${esc(q)} <span class="expect">· ${esc(note)}</span>`;
    b.addEventListener('click', () => runQuery(q));
    qRow.append(b);
  }

  const sRow = $('nibli-scenarios');
  sRow.textContent = '';
  for (const sc of ex.scenarios) {
    const b = document.createElement('button');
    b.className = 'nibli-sbtn';
    b.textContent = sc.label;
    b.addEventListener('click', () => runScenario(sc, b));
    sRow.append(b);
  }
  const reset = document.createElement('button');
  reset.className = 'nibli-sbtn';
  reset.textContent = 'Reset knowledge base';
  reset.addEventListener('click', () => loadExample(currentKb));
  sRow.append(reset);
}

async function runScenario(sc, btn) {
  if (busy) return;
  const target = kbItems.find(i => i.kind === 'fact' && !i.retracted && !i.error && sc.match(i.text));
  if (!target) return;
  setBusy(true, `engine: retracting fact #${target.factId}…`);
  const r = await call('retract', { factId: target.factId });
  setBusy(false);
  if (!r.ok) { setStatus('engine: retract failed — ' + r.error); return; }
  target.retracted = true;
  btn.dataset.done = '1';
  renderTriad();
  setStatus(`engine: live · retracted "${target.text}" — re-running the headline queries`);
  for (const q of sc.rerun) await runQuery(q);
  document.querySelectorAll('.nibli-sbtn[data-done]').forEach(b => { b.disabled = true; });
}

/* ── running a query + rendering the proof tree ─────────────────────────── */
async function runQuery(q) {
  if (busy) return;
  setBusy(true, 'engine: proving… (real backward chaining, depth-limited)');
  const t0 = performance.now();
  const r = await call('query', { q });
  const ms = Math.max(1, Math.round(performance.now() - t0));
  setBusy(false);
  const res = r.ok ? r.res : { status: 'ERROR', proof_text: r.error, proof: null };

  const box = $('nibli-result');
  box.hidden = false;
  $('result-query').textContent = '? ' + q;
  const badge = $('result-badge');
  badge.textContent = res.status + (res.detail ? ` (${res.detail})` : '');
  badge.className = 'nibli-badge ' + ({
    'TRUE': 'nibli-badge--true', 'FALSE': 'nibli-badge--false',
    'UNKNOWN': 'nibli-badge--unknown', 'RESOURCE_EXCEEDED': 'nibli-badge--resource',
  }[res.status] || 'nibli-badge--resource');
  $('result-naf').hidden = !res.naf_dependent;
  $('result-proof').textContent = '';
  if (res.proof && res.proof.steps) {
    $('result-proof').append(renderStep(res.proof, res.proof.root, 0));
  } else if (res.proof_text) {
    const pre = document.createElement('pre');
    pre.textContent = res.proof_text;
    $('result-proof').append(pre);
  }
  setStatus(`engine: live · proved in ${ms}ms, on your hardware`);
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const RULE_LABELS = {
  conjunction: 'Conjunction', negation: 'Negation [NAF]',
  exists_witness: 'Exists', exists_failed: 'Exists: no witness',
  forall_verified: '∀ verified', forall_counterexample: '∀ counterexample',
  forall_vacuous: '∀ vacuous', asserted: 'Fact', derived: 'Rule',
  proof_ref: '(see above)', rule_attempt_failed: 'Rule attempt failed',
  predicate_not_found: 'Not found', predicate_check: 'Predicate',
  compute_check: 'Compute', modal_passthrough: 'Modal',
  disjunction_check: 'Disjunction', disjunction_intro: 'Disjunction intro',
  equality_substitution: 'Equality', count_result: 'Count',
};

function stepLabel(rule) {
  const term = t => t ? (t.value !== null && t.value !== undefined ? t.value : t.number) : '';
  switch (rule.type) {
    case 'asserted':   return `Fact: ${rule.fact}`;
    case 'derived':    return `Rule (${rule.label}): ${rule.fact}`;
    case 'proof_ref':  return `(see above): ${rule.fact}`;
    case 'exists_witness': return `Exists: ${rule.var} = ${term(rule.term)}`;
    case 'rule_attempt_failed': return `Rule (${rule.rule_label}) failed: ${rule.failed_condition}`;
    case 'predicate_not_found': return `Not found: ${rule.predicate}`;
    case 'forall_counterexample': return `∀ counterexample: ${term(rule.entity)}`;
    default: return RULE_LABELS[rule.type] || rule.type;
  }
}

function renderStep(trace, idx, depth) {
  const step = trace.steps[idx];
  if (!step || depth > 40) return document.createTextNode('');
  const holds = `<span class="${step.holds ? 'holds-true' : 'holds-false'}">→ ${step.holds ? 'TRUE' : 'FALSE'}</span>`;
  const naf = step.rule.type === 'negation' ? 'naf-step' : '';
  const label = `<span class="${naf}">${esc(stepLabel(step.rule))}</span> ${holds}`;

  if (!step.children || step.children.length === 0) {
    const leaf = document.createElement('span');
    leaf.className = 'leaf';
    leaf.innerHTML = label;
    return leaf;
  }
  const det = document.createElement('details');
  det.open = depth < 3;
  const sum = document.createElement('summary');
  sum.innerHTML = label;
  det.append(sum);
  for (const c of step.children) det.append(renderStep(trace, c, depth + 1));
  return det;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── the 30-second tour ─────────────────────────────────────────────────── */
/* Click-to-advance; every step drives the SAME functions the buttons do —
   the tour is a pointing finger, not a second engine path. */
const TOUR = [
  {
    text: 'A slice of the GDPR, formalized. Left: what a human wrote. Middle: Lojban, ' +
      'compiled to logic and asserted into the live engine. Right: the mechanical gloss ' +
      'a reviewer verifies. Twenty-three facts, in your tab.',
    run: () => loadExample('gdpr'),
  },
  {
    text: 'Adam consented, so the engine PROVES his processing has a lawful basis — expand ' +
      'the derivation below. A badge, a proof chain, no confidence score.',
    run: () => runQuery('la .adam. cu se curmi'),
  },
  {
    text: 'Now Adam withdraws consent. One fact retracted, and the verdicts flip — erasure ' +
      'becomes an obligation. The ⚑ flag is the engine disclosing this rests on the ' +
      'closed-world assumption.',
    run: async () => {
      const sc = EXAMPLES.gdpr.scenarios[0];
      const btn = [...document.querySelectorAll('.nibli-sbtn')]
        .find(b => b.textContent === sc.label);
      if (btn && !btn.disabled) await runScenario(sc, btn);
    },
  },
  {
    text: 'That’s the whole trick: derivation, not prediction. Every answer is TRUE with a ' +
      'proof, FALSE, or an honest UNKNOWN. Try the other examples — or Reset and break this one.',
    run: () => {},
  },
];

let tourIdx = -1;

async function tourStep(i) {
  tourIdx = i;
  const bar = $('nibli-tour');
  bar.hidden = false;
  $('tour-step').textContent = `${i + 1}/${TOUR.length}`;
  $('tour-text').textContent = TOUR[i].text;
  const next = $('tour-next');
  next.textContent = i === TOUR.length - 1 ? 'Done ✓' : 'Next →';
  next.disabled = true;
  await TOUR[i].run();
  next.disabled = false;
}

function endTour() {
  tourIdx = -1;
  $('nibli-tour').hidden = true;
}

$('nibli-tour-btn').addEventListener('click', () => { if (!busy) tourStep(0); });
$('tour-skip').addEventListener('click', endTour);
$('tour-next').addEventListener('click', () => {
  if (busy) return;
  if (tourIdx >= TOUR.length - 1) endTour();
  else tourStep(tourIdx + 1);
});

/* ── boot ───────────────────────────────────────────────────────────────── */
document.querySelectorAll('.nibli-tab').forEach(b =>
  b.addEventListener('click', () => { if (!busy) { endTour(); loadExample(b.dataset.kb); } }));
loadExample('syllogism');
