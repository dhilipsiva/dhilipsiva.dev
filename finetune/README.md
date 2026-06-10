# finetune/ — baking dhilipsiva into the twin

Pipeline: persona facts → ChatML dataset → LoRA on SmolLM2-135M-Instruct → merge →
GGUF q8_0 → a `MODELS` entry in `static/play/app/brain.js`. The runtime auto-detects
the architecture, so the fine-tuned model is a drop-in.

## Files
- `persona.md` — canonical fact sheet (from the 2026-06 LinkedIn profile + site).
  **The phone number is deliberately excluded.** Update this first when facts change.
- `seeds.json` — hand-authored Q/A pairs in his voice (the actual training signal).
- `generate_dataset.py` — expands seeds → `data/{train,eval}.jsonl` (ChatML messages).
- `train.py` — LoRA (r=16) fine-tune, merges the adapter, saves `out/merged`.
- `.venv/` — local env (gitignored): torch cu128 + transformers + peft + datasets.

## Run it
```powershell
cd finetune
.venv\Scripts\python.exe generate_dataset.py       # emits both datasets
.venv\Scripts\python.exe train.py                  # SmolLM2-135M twin (persona)
.venv\Scripts\python.exe train.py --base qwen      # Qwen2.5-0.5B twin (persona + MCP TOOL calls)
```

**Two models, one rule:** each fine-tune's `system:` in `static/play/app/brain.js`
(`twin` → `SYSTEM`, `twinq` → `SYSTEM_TOOLS`) must equal the corresponding string in
`generate_dataset.py` **verbatim** — recall is conditioned on the training system prompt.
The qwen twin learns tool calls from `tool_seeds.json` (persona reply + a final
`TOOL {"app":...,"params":{...}}` line); persona seeds under the same system teach it
when NOT to call. brain.js skips the live `MCP.toolPrompt()` menu for models that carry
their own system — the menu is baked.

## Convert to GGUF (llama.cpp converter)
```powershell
.venv\Scripts\python.exe -m pip install gguf safetensors sentencepiece
# fetch the converter once:
Invoke-WebRequest https://raw.githubusercontent.com/ggml-org/llama.cpp/master/convert_hf_to_gguf.py -OutFile convert_hf_to_gguf.py
.venv\Scripts\python.exe convert_hf_to_gguf.py out/merged --outtype q8_0 --outfile out/dhilipsiva-twin-q8_0.gguf
```

## Wire it into the site
Local serving (dev / any host without file-size limits):
```powershell
Copy-Item out/dhilipsiva-twin-q8_0.gguf ../static/play/models/
```
…then add to `MODELS` in `static/play/app/brain.js`:
```js
twin: {
  label: 'dhilipsiva-twin · 145MB',
  detail: 'fine-tuned to impersonate me — still lies, but in my voice',
  model: '/play/models/dhilipsiva-twin-q8_0.gguf',   // or the HF URL below
  tokenizer: 'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/tokenizer.json',
  tools: false
},
```
**Note:** the gguf is ~145MB — over GitHub's 100MB hard limit, so `static/play/models/`
is gitignored. For production, upload to Hugging Face and point `model:` at
`https://huggingface.co/dhilipsiva/dhilipsiva-twin-gguf/resolve/main/dhilipsiva-twin-q8_0.gguf`
(`huggingface-cli upload dhilipsiva/dhilipsiva-twin-gguf out/dhilipsiva-twin-q8_0.gguf`).

## Improving it
- The dataset is the product: add/extend `seeds.json` (more phrasings, more refusals,
  more Tamil), regenerate, retrain. 4 epochs on ~500 examples is a starting point.
- A 135M base will still drift on long answers; the system prompt + scripted router
  remain the guardrails. For a steadier twin, swap `BASE` to a Qwen2.5-0.5B-Instruct
  and re-run — the site already handles qwen2 GGUFs.
- The fluency–truth banner stays regardless. That's the bit that's true.
