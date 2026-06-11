# finetune/ — baking dhilipsiva into the twins (a follow-along runbook)

Two small models impersonate me on [dhilipsiva.dev](https://dhilipsiva.dev), running
entirely in the visitor's browser (candle, Rust→WebAssembly):

| model in the header | base | what it learned |
|---|---|---|
| `dhilipsiva-twin` (138MB) | SmolLM2-135M-Instruct | persona — answers as me |
| `dhilipsiva-twin-qwen` (507MB) | Qwen2.5-0.5B-Instruct | persona **+** emits `TOOL {"app":…}` lines that open the site's MCP apps |

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

## 2. Generate the datasets

```powershell
cd finetune
.venv\Scripts\python.exe generate_dataset.py
```

Prints something like `wrote 228 train / 11 eval` (smol) and `285 train / 15 eval`
(qwen). Each line is a ChatML `messages` triple: system, user, assistant. The qwen
dataset = plain seeds + tool seeds, under the tools-aware system prompt.

## 3. Train (both models)

```powershell
.venv\Scripts\python.exe train.py --base smol    # ~2 min on a 5090
.venv\Scripts\python.exe train.py --base qwen    # ~5 min
```

LoRA r=32/α=64, lr 2e-4 cosine, **24 epochs** — deliberately overfit: these are
persona parrots, not encyclopedias. Three hard-won details live in `train.py`;
don't undo them:

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

Each run ends with greedy generations for ~5 probes (`who are you?`,
`what is nibli?`, `did you work at Google?`, `show me your rust projects`,
`how do I contact you?`). Good looks like: facts from `persona.md`, my register,
a clean stop, the Google question answered with the real employer list — and for
qwen, a well-formed `TOOL {…}` line on the "show me" probe. If answers ramble or
miss facts, the dataset needs more phrasings, not more epochs.

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

`static/play/app/brain.js` already points `twin`/`twinq` at the HF resolve URLs.
After every re-upload, **bump the `?v=N` suffix** on those URLs — browsers cache
half-gigabyte files enthusiastically. Then:

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
