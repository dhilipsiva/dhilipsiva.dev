/* ── the three examples, copy from the book (Ch 19, 20, 21) ─────────────── */
export const EXAMPLES = {
  'syllogism': {
    scenario: "The book's minimal worked example (Ch 19): three plain statements — all dogs are " +
      "animals, all animals eat, Adam is a dog. The left pane is what a human wrote; the middle " +
      "is the formal nibli KR, asserted into the live engine line by line; the right is the " +
      "mechanical gloss a reviewer verifies. Every TRUE below arrives with its derivation.",
    queries: [
      { q: 'eats(Adam).', note: 'does Adam eat? — a 2-hop proof' },
      { q: 'animal(Adam).', note: 'is Adam an animal? — 1 hop' },
      { q: 'bird(Adam).', note: 'is Adam a bird? — a real FALSE' },
    ],
    scenarios: [],
  },
  'gdpr': {
    scenario: "Chapter 20: a formalizable slice of the GDPR (Articles 5, 6, 7, 9, 15, 17, 33). " +
      "Adam consented, so processing has a lawful basis. AkmeCorp suffered a breach; Google " +
      "didn't. Then withdraw Adam's consent and watch the lawful basis collapse — with the " +
      "engine disclosing that the erasure verdict now rests on the closed-world assumption.",
    queries: [
      { q: 'permitted(Adam).', note: 'lawful basis? (Art 6)' },
      { q: 'obliged(Adam, event { removes() }).', note: 'right to erasure? (Art 17)' },
      { q: 'permitted(Gugli).', note: 'a controller is not a consenting person — exhaustive FALSE' },
      { q: 'data(Kanrek).', note: 'health record → personal data (Art 4/9, derived)' },
    ],
    scenarios: [
      { label: 'Withdraw Adam’s consent',
        match: l => l.includes('approves') && l.includes('Adam'),
        rerun: ['permitted(Adam).', 'obliged(Adam, event { removes() }).'] },
    ],
  },
  'drug-interactions': {
    scenario: "Chapter 21: the warfarin + fluconazole interaction, mechanistically. Fluconazole " +
      "inhibits CYP2C9; warfarin is metabolized by CYP2C9 and has a narrow therapeutic index — " +
      "so its concentration rises, that's a toxicity risk, and a safety alert fires (a 3-hop " +
      "proof). Apixaban rides CYP3A4 and stays quiet: a real, deductively-derived FALSE. Then " +
      "discontinue fluconazole and watch the whole alert chain collapse.",
    queries: [
      { q: 'increases(Varfarin).', note: 'concentration rising?' },
      { q: 'dangerous(Varfarin).', note: 'toxicity risk?' },
      { q: 'warns(Varfarin).', note: 'safety alert? (3-hop proof)' },
      { q: 'warns(Apiksaban).', note: 'negative control — no alert' },
    ],
    scenarios: [
      { label: 'Discontinue fluconazole',
        match: l => l.includes('prevents') && l.includes('Flukonazol') && !l.includes('->'),
        rerun: ['warns(Varfarin).', 'warns(Apiksaban).'] },
    ],
  },
};

