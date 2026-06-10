"""Upload the fine-tuned twin GGUFs (+ tokenizers + model card) to Hugging Face.

Requires a prior `hf auth login` with a write token. Then:

    .venv\\Scripts\\python.exe hf_upload.py
"""
from pathlib import Path

from huggingface_hub import HfApi, whoami

HERE = Path(__file__).parent
REPO = "dhilipsiva/dhilipsiva-twin-gguf"

CARD = """---
license: apache-2.0
language: [en]
base_model:
- HuggingFaceTB/SmolLM2-135M-Instruct
- Qwen/Qwen2.5-0.5B-Instruct
tags: [gguf, persona, candle, webassembly, chatml]
---

# dhilipsiva-twin — on-device persona models

LoRA fine-tunes that impersonate [dhilipsiva](https://dhilipsiva.com) — they ARE his
website: served into the visitor's browser and run entirely on-device via
[candle](https://github.com/huggingface/candle) compiled to WebAssembly.

| file | base | size | extra trick |
|---|---|---|---|
| `dhilipsiva-twin-q8_0.gguf` | SmolLM2-135M-Instruct | 138MB | persona |
| `dhilipsiva-twin-qwen-q8_0.gguf` | Qwen2.5-0.5B-Instruct | 507MB | persona + emits `TOOL {"app":…}` lines that open the site's MCP apps |

Tokenizers included as `tokenizer-smol.json` / `tokenizer-qwen.json`.

ChatML prompting. **The system prompt must match the training prompt verbatim** —
see `finetune/generate_dataset.py` in the [site repo](https://github.com/dhilipsiva/dhilipsiva.com)
(`SYSTEM` for smol, `SYSTEM_TOOLS` for qwen). Greedy decoding recommended: these are
overfit on purpose — persona parrots, not encyclopedias.

⊥ **These models will lie, confidently.** Fluent ≠ true — that gap is the point:
it's why dhilipsiva builds [nibli](https://github.com/dhilipsiva/nibli), a
hallucination firewall that derives answers with proof traces instead of
predicting plausible text. Trained facts are accurate as of 2026-06; everything
else is improv.
"""

FILES = [
    (HERE / "out/dhilipsiva-twin-q8_0.gguf", "dhilipsiva-twin-q8_0.gguf"),
    (HERE / "out/dhilipsiva-twin-qwen-q8_0.gguf", "dhilipsiva-twin-qwen-q8_0.gguf"),
    (HERE / "out/merged/tokenizer.json", "tokenizer-smol.json"),
    (HERE / "out/merged-qwen/tokenizer.json", "tokenizer-qwen.json"),
]

def main() -> None:
    print("logged in as:", whoami()["name"])
    api = HfApi()
    api.create_repo(REPO, repo_type="model", exist_ok=True)
    api.upload_file(path_or_fileobj=CARD.encode(), path_in_repo="README.md", repo_id=REPO)
    for src, dest in FILES:
        print(f"uploading {dest} ({src.stat().st_size / 1e6:.0f} MB)…")
        api.upload_file(path_or_fileobj=src, path_in_repo=dest, repo_id=REPO)
    print(f"done -> https://huggingface.co/{REPO}")

if __name__ == "__main__":
    main()
