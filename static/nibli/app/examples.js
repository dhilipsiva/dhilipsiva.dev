/* ── the three examples, curated teaching models ─────────────── */
export const EXAMPLES = {
  'syllogism': {
    scenario: "A minimal worked example: three plain statements — all dogs are " +
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
    scenario: "A reviewed processing case binds ControllerA, Adam, RecordsA, and ResearchPurpose. Article 6 consent is scoped to this case. Article 9 has a separate review condition. Controller duties and subject rights name actions; no action is inferred to have happened. Article 17 requires explicit withdrawal plus completed basis and exception reviews. Article 33 uses a reviewed breach-risk input. This bounded teaching model is not a compliance verdict.",
    queries: [
    {
        "q": "permits(ControllerA, CaseA, Article6Consent).",
        "note": "scoped consent route (Article 6)"
    },
    {
        "q": "obliged(ControllerA, EraseRecords, Article17Withdrawal).",
        "note": "erasure duty requires withdrawal and reviews"
    },
    {
        "q": "entitled(Adam, ProvideAccess, Article15).",
        "note": "subject access right (Article 15)"
    },
    {
        "q": "permits(ControllerA, CaseA, Article9Condition).",
        "note": "Article 9 condition is separate"
    }
],
    scenarios: [{ label: 'Remove consent evidence (not withdrawal)', match: l => l.trim() === 'member(CaseA, ValidConsentRecorded).', rerun: ['permits(ControllerA, CaseA, Article6Consent).', 'obliged(ControllerA, EraseRecords, Article17Withdrawal).'] }],
  },
  'drug-interactions': {
    scenario: "Candidate interaction assessments bind a patient, episode, and drug pair. Fluconazole has selected CYP2C9 and CYP3A4 inhibition edges. Warfarin and phenytoin have selected CYP2C9 pathways; apixaban has a CYP3A4 pathway. A shared pathway and relevant exposure to both drugs in the same patient and episode produce a review duty. Narrow therapeutic index adds priority. No concentration, toxicity, safety, or treatment result is inferred.",
    queries: [
    {
        "q": "fit(AssessWarfarin, SharedMechanism, ScreeningPolicy).",
        "note": "selected shared pathway"
    },
    {
        "q": "fit(AssessWarfarin, ConcurrentExposure, ScreeningPolicy).",
        "note": "same-patient same-episode exposures"
    },
    {
        "q": "obliged(ReviewTeam, ReviewWarfarin, ScreeningPolicy).",
        "note": "review duty, not measured toxicity"
    },
    {
        "q": "obliged(ReviewTeam, ReviewApixaban, ScreeningPolicy).",
        "note": "apixaban: mechanism present, exposure absent"
    }
],
    scenarios: [{ label: 'Withdraw relevant fluconazole exposure after reassessment', match: l => l.trim() === 'member(ExposureFluconazole, RelevantExposures).', rerun: ['fit(AssessWarfarin, SharedMechanism, ScreeningPolicy).', 'obliged(ReviewTeam, ReviewWarfarin, ScreeningPolicy).'] }],
  },
};
