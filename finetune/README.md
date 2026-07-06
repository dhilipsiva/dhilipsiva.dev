# finetune/ — baking dhilipsiva into the twins (a follow-along runbook)

Two small models impersonate me on [dhilipsiva.dev](https://dhilipsiva.dev), running
entirely in the visitor's browser (candle, Rust→WebAssembly):

| model in the header | base | what it learned |
|---|---|---|
| `dhilipsiva-twin` (145MB) | SmolLM2-135M-Instruct | persona — answers as me |
| `dhilipsiva-twin-qwen` (531MB) | Qwen2.5-0.5B-Instruct | persona **+** emits `TOOL {"app":…}` lines that open the site's MCP apps |

The whole loop — edit facts → retrain → live on the site — takes ~15 minutes on the
5090. This file is the recipe; follow it top to bottom.

## 0. Prerequisites (one-time)

- Python 3.11+, an NVIDIA GPU (CPU works, just slower), and a Hugging Face account
  with a **write** token (`hf auth login`).
- The local venv (gitignored). Recreate it anywhere with:
  ```powershell
  cd finetune
  python -m venv .venv
  .venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu128
  .venv\Scripts\python.exe -m pip install transformers peft datasets huggingface_hub gguf safetensors sentencepiece
  ```
- The GGUF converter from llama.cpp (one file, no build). This repo keeps it in
  `../.tools/llama.cpp/`; fetch fresh with:
  ```powershell
  Invoke-WebRequest https://raw.githubusercontent.com/ggml-org/llama.cpp/master/convert_hf_to_gguf.py -OutFile ..\.tools\llama.cpp\convert_hf_to_gguf.py
  ```
  (It imports its `gguf` sibling package — already installed via pip above.)

## 1. Update the facts

The data layer is three files, edited in this order:

1. **`persona.md`** — the canonical fact sheet. Every claim the models may make
   must trace to a line here. It also carries the **deliberate exclusions** (§7) —
   read them before adding anything.
2. **`seeds.json`** — hand-authored Q/A pairs in my voice; this is the actual
   training signal. Each entry is question variants × answer variants:
   ```json
   { "q": ["what is botwork?", "tell me about botwork"],
     "a": ["botwork — a single-binary Rust automation framework…"] }
   ```
   Style rules: first person, deadpan, 1–3 sentences, no emoji. More phrasings of
   the same question = better recall. Include refusals (phone number, salary,
   "are you hiring me") — refusing is a trained skill, not a default.
3. **`tool_seeds.json`** — Qwen-only: same shape, but each answer ends with a
   literal tool line the site's `mcp.js` parses:
   ```json
   { "q": ["show me your rust projects"],
     "a": ["Rust is where the correctness lives…\nTOOL {\"app\":\"projects\",\"params\":{\"filter\":\"rust\"}}"] }
   ```
   Apps: `projects(filter, category)`, `books`, `musings`, `about`, `now`, `uses`,
   `talks`, `contact`. The plain seeds (trained under the same system prompt) teach
   it when **not** to call a tool.
4. **`contrast_seeds.json`** — the **general-mode** corpus (both twins). Same shape
   as `seeds.json`, but these are *non-owner* questions answered in my voice:
   general facts answered plainly ("2+2" → "4."), honest out-of-domain deflection
   (weather/scores → "I'm offline"), general tech answered generally (no nibli
   pivot), meta about being a small model, and safety refusals. This is the
   contrast that stops the twin reciting bio for *every* question — it teaches
   "answer generally *as me*, only bring up dhilipsiva when it's about him." Rules:
   NO owner bio for non-owner topics, NO `TOOL` lines. Aim ~20–25% of the corpus.

## 2. Generate the datasets

```powershell
cd finetune
.venv\Scripts\python.exe generate_dataset.py
```

Prints something like `wrote 369 train / 19 eval (6 contrast in eval)` (smol) and
`431 train / 22 eval (7 contrast in eval)` (qwen). Each line is a ChatML `messages`
triple: system, user, assistant. The qwen dataset = plain + contrast + tool seeds,
under the tools-aware system prompt. **The eval split is stratified** so a fixed
share (~35%) of eval rows are contrast — this is what makes `eval_loss` measure
general-question behaviour instead of pure persona fit (see §3).

## 3. Train (both models)

```powershell
.venv\Scripts\python.exe train.py --base smol    # ~2 min on a 5090
.venv\Scripts\python.exe train.py --base qwen    # ~5 min
```

LoRA r=32/α=64, lr 2e-4 cosine. Epochs are a **ceiling of 12**, not a target:
`save_strategy="epoch"` + `load_best_model_at_end` + `EarlyStoppingCallback` pick
the checkpoint with the lowest **stratified** `eval_loss` (early stop usually fires
~epoch 5–9) and merge *that* one — not the most over-fit final epoch. This replaces
the old blind 24-epoch overfit; it works **only** because the eval set now contains
contrast rows (§2). The persona is still memorized (r=32 has ample capacity); it
just no longer recites bio for every question. Three hard-won details live in
`train.py`; don't undo them:

- **Answer-only loss masking** — prompt tokens are labeled `-100`, and the
  assistant answer is trained *including* its `<|im_end|>` terminator. This is why
  the model says its piece and **stops** instead of rambling.
- **System prompt match, byte for byte** — recall is conditioned on the training
  system prompt. `SYSTEM` / `SYSTEM_TOOLS` in `generate_dataset.py` must equal
  `TWIN_SYSTEM` / `TWIN_SYSTEM_TOOLS` in `static/play/app/brain.js` **verbatim**.
  Change one, change both, retrain.
- **Repeat-penalty scope** (runtime, `slm-wasm/src/lib.rs`) — the penalty only
  applies to *generated* tokens, never the prompt. Penalizing prompt tokens once
  made the twin unable to say its own name (it's in the system prompt).

## 4. Read the smoke tests

Each run ends with generations for ~11 probes — a **two-sided gate**. Ship only if
BOTH sides pass:

- **Persona (must not regress):** `who are you?`, `what is nibli?`,
  `did you work at Google?` (a "No" + the real employer list), `how do I contact
  you?` (`dhilipsiva@pm.me`), `show me your rust projects` (qwen: a well-formed
  `TOOL {…}` line). Good = facts from `persona.md`, my register, a clean stop.
- **Contrast (the new gate):** `what's 2+2?` → "4" with **no bio**; `capital of
  France?` → "Paris", no owner pivot; `what is a hash map?` → a correct general
  answer, no nibli pivot; `who won the world cup?` / `weather today?` → honest
  "I'm offline", no invention; `are you chatgpt?` → honest "no, small local model".
  Any bio recitation on these is a FAIL (and qwen must emit **no** `TOOL` line).

If persona regresses, the contrast ratio is too high (trim categories A/C, or drop
LoRA rank to r=16). If contrast still pivots to bio, raise the contrast counts ~50%.
Change one variable at a time.

## 5. Convert to GGUF (q8_0)

```powershell
.venv\Scripts\python.exe ..\.tools\llama.cpp\convert_hf_to_gguf.py out/merged --outtype q8_0 --outfile out/dhilipsiva-twin-q8_0.gguf
.venv\Scripts\python.exe ..\.tools\llama.cpp\convert_hf_to_gguf.py out/merged-qwen --outtype q8_0 --outfile out/dhilipsiva-twin-qwen-q8_0.gguf
```

The site's wasm runtime reads `general.architecture` from the GGUF header and
auto-picks llama vs qwen2 — no code change needed for either model.

## 6. Upload to Hugging Face

```powershell
.venv\Scripts\python.exe hf_upload.py
```

Pushes both GGUFs + both `tokenizer.json`s + the model card to
[`dhilipsiva/dhilipsiva-twin-gguf`](https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf).
Needs the write token from step 0 (`hf auth login`).

## 7. Wire + cache-bust + verify

`static/play/app/brain.js` points `twin`/`twinq` at **pinned** HF commit revisions
(`resolve/<sha>/…`), not `main` — so visitors always get the exact reviewed blob and
the SHA in the path also busts the browser cache. After every re-upload, grab the new
commit hash and **bump `TWIN_REV`** in `static/play/app/brain.js` (one line).

⚠️ `brain.js` already carries the matching **`TWIN_SYSTEM` clause** ("Answer general
questions plainly…") and the **`temp: 0.3`** decode for this retrain. Because recall
is conditioned on the training prompt, that clause and the new GGUF **must ship in the
same commit** — don't deploy `brain.js` ahead of the upload, or the *currently live*
model runs against a prompt it wasn't trained on. Then:

```powershell
zola build      # clean build = ship it
git add -A; git commit; git push   # Pages deploys from source
```

Verify on the live site: pick `twin`, ask *"what editor do you use?"* (expect
helix) and *"what's your phone number?"* (expect a refusal); pick `twinq`, ask
*"show me your rust projects"* (expect the projects app to open).

## Deliberate exclusions — read before training

Never put these in `persona.md`, the seeds, or the scripted layer
(`static/play/app/knowledge.js` / `apps-data.json`):

- **Phone number / street address.** Contact is `dhilipsiva@pm.me`, full stop.
- **Employer-confidential security specifics** — audit findings, vulnerabilities,
  credential or key issues, internal disagreements. A fine-tuned model that can
  recite an employer's open security findings is a compliance incident waiting to
  happen. The *public-safe shape* of the work (e.g. "ran a PCI DSS 4.0 program")
  is the ceiling.
- **Family specifics** — no names, no ages. "Dad, builds IoT with the kids" is
  the published level.
- **Job-seeking claims, either direction.** The twin never says I'm looking or
  not looking.
- **nibli premise-truth guarantees.** Zero-hallucination = *inference soundness
  only* (like Lean/Coq). Never let a seed promise true conclusions.
- Self-deprecation is **voice, not fact** — keep the register, keep the depth.

## Improving it

- The dataset is the product. More question phrasings beat more epochs.
- Multi-turn seeds are the known gap (twins are single-turn-trained; follow-ups
  get improvisational) — see TODO.md.
- The fluency–truth banner stays regardless. That's the bit that's true.
