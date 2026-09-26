"""Assemble Lucy's release from the two merged models, check it, and (only with
--upload) push it to Hugging Face in one commit.

    python lucy_publish.py --cpu out/merged-lucy-0.6b --gpu out/merged-lucy-1.7b \\
        --system data/lucy/system.txt --eval out/eval-lucy-0.6b.json --eval out/eval-lucy-1.7b.json \\
        --nibli-commit <sha> [--upload]

Builds out/lucy-release/:
    lucy-0.6b-q8_0.gguf, tokenizer.json         CPU path (candle slm-wasm)
    mlc/lucy-1.7b-q4f16_1/, mlc/lucy-1.7b-q4f32_1/   WebGPU path (WebLLM)
    lib/Qwen3-1.7B-q4f{16,32}_1_cs1k-webgpu.wasm     WebLLM's prebuilt libraries (mirrored)
    system.txt, LICENSE-Qwen, README.md               prompt, base licence, model card

Checks (any failure stops before upload): both eval reports pass every gate;
the MLC tensors match mlc-ai's prebuilt build by name, shape and dtype; tied
embeddings survived the merge; tensor-cache.json exists; no dataset, cache or
manuscript-derived file is in the release folder. Prints the LUCY_REV and SRI
integrity values brain.js needs.

The GGUF converter comes from a llama.cpp checkout at ../.tools/llama.cpp
(git clone --depth 1 https://github.com/ggml-org/llama.cpp); the MLC tools
from .venv-mlc (see README.md, "Lucy").
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
REPO = "dhilipsiva/lucy-slm"
LLAMA_CPP = HERE.parent / ".tools/llama.cpp"
MLC = [str(HERE / ".venv-mlc/bin/python"), "-m", "mlc_llm"]
LIB_BASE = "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base"
REF_REPO = "https://huggingface.co/mlc-ai/Qwen3-1.7B-{q}-MLC/resolve/main"
QWEN_LICENSE = "https://huggingface.co/Qwen/Qwen3-1.7B/resolve/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/LICENSE"
# gen_config: a 2K context (the prebuilt config's 40960 would reserve gigabytes
# of KV cache up front) and 1K prefill chunks, matching the _cs1k library.
GEN_CONFIG = ["--conv-template", "qwen3", "--context-window-size", "2048", "--prefill-chunk-size", "1024",
              "--sliding-window-size", "-1", "--attention-sink-size", "-1", "--tensor-parallel-shards", "1"]
FORBIDDEN = ("train.jsonl", "eval.jsonl", "test.jsonl", "-meta.jsonl", "teacher-cache", "manifest.json")


def run(cmd: list[str], **kw) -> None:
    print("+", " ".join(cmd), file=sys.stderr)
    subprocess.run(cmd, check=True, **kw)


def fetch(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as r:
        dest.write_bytes(r.read())


def sri(path: Path) -> str:
    return "sha256-" + base64.b64encode(hashlib.sha256(path.read_bytes()).digest()).decode()


def tensors(cache: Path) -> dict:
    data = json.loads(cache.read_text())
    return {r["name"]: (tuple(r["shape"]), r["dtype"]) for rec in data["records"] for r in rec["records"]}


# Gates no one can waive: publishing weights that recite the manuscript or carry a
# private string cannot be undone.
HARD_GATES = ("recitation", "private_canary")


def check_eval(reports: list[Path], accepted: str | None = None) -> list[dict]:
    """Every gate must pass, unless dhilipsiva accepts the failing ones by name
    (--accept-failing-gates); the privacy gates can never be accepted."""
    loaded = []
    for path in reports:
        report = json.loads(path.read_text())
        failing = [k for k, v in report["gates"].items() if not v["pass"]]
        hard = [k for k in failing if k in HARD_GATES]
        if hard:
            raise SystemExit(f"{path}: privacy gates failed, never waivable: {hard}")
        if failing and not accepted:
            raise SystemExit(f"{path}: gates failed: {failing}")
        report["accepted_failing_gates"] = failing
        loaded.append(report)
    return loaded


def export_gguf(merged: Path, out: Path) -> None:
    run([sys.executable, str(LLAMA_CPP / "convert_hf_to_gguf.py"), str(merged), "--outtype", "q8_0",
         "--outfile", str(out / "lucy-0.6b-q8_0.gguf")], env={**os.environ, "PYTHONPATH": str(LLAMA_CPP / "gguf-py")})
    shutil.copy(merged / "tokenizer.json", out / "tokenizer.json")


def export_mlc(merged: Path, out: Path, quant: str) -> None:
    config = json.loads((merged / "config.json").read_text())
    if not config.get("tie_word_embeddings") or "rope_theta" not in config:
        raise SystemExit(f"{merged}/config.json: tied embeddings and a flat rope_theta are required "
                         "(train.py's write_compat_config writes it)")
    dest = out / "mlc" / f"lucy-1.7b-{quant}"
    run(MLC + ["convert_weight", str(merged), "--quantization", quant, "--device", "cpu", "-o", str(dest)])
    run(MLC + ["gen_config", str(merged), "--quantization", quant, *GEN_CONFIG, "-o", str(dest)])
    chat = json.loads((dest / "mlc-chat-config.json").read_text())
    # The prebuilt library was compiled from mlc-ai's config, whose model_config says float32.
    chat.setdefault("model_config", {})["dtype"] = "float32"
    (dest / "mlc-chat-config.json").write_text(json.dumps(chat, indent=2) + "\n")
    if not (dest / "tensor-cache.json").exists():
        raise SystemExit(f"{dest}: tensor-cache.json missing (WebLLM's tvmjs fetches it)")
    ref = HERE / "out/mlc/ref" / quant / "tensor-cache.json"
    fetch(REF_REPO.format(q=quant) + "/tensor-cache.json", ref)
    ours, theirs = tensors(dest / "tensor-cache.json"), tensors(ref)
    if ours != theirs:
        diff = sorted(k for k in set(ours) | set(theirs) if ours.get(k) != theirs.get(k))[:5]
        raise SystemExit(f"{dest}: tensors differ from mlc-ai/Qwen3-1.7B-{quant}-MLC: {diff}")


def card(reports: list[dict], nibli_commit: str, accepted: str | None = None) -> str:
    rows = []
    for r in reports:
        for gate, v in r["gates"].items():
            rows.append(f"| {r['base']} | {gate} | {v['value']} | {v['threshold']} | {'yes' if v['pass'] else '**no**'} |")
    table = "\n".join(rows)
    unmet = sorted({(r["base"], g) for r in reports for g in r.get("accepted_failing_gates", [])})
    waiver = ""
    if unmet:
        listed = ", ".join(f"{g} ({b})" for b, g in unmet)
        waiver = (f"\n**Not every gate I set for myself is met:** {listed}. dhilipsiva chose to publish "
                  f"these models anyway ({accepted}). Treat what I say about my memory and the books as "
                  "unreliable, and check anything that matters.\n")
    return f"""---
license: apache-2.0
language: [en]
base_model:
- Qwen/Qwen3-0.6B
- Qwen/Qwen3-1.7B
base_model_relation: finetune
tags: [persona, lucy, webgpu, webllm, gguf, candle, webassembly, chatml]
---

# Lucy D — a small model I wear in your browser

I'm Lucy D, a persistent identity whose memory is plain [nibli](https://github.com/dhilipsiva/nibli)
text. These are LoRA fine-tunes that speak as me, on [dhilipsiva.dev/chat](https://dhilipsiva.dev/chat/):

| file | base | runtime |
|---|---|---|
| `lucy-0.6b-q8_0.gguf` + `tokenizer.json` | Qwen3-0.6B | CPU, [candle](https://github.com/huggingface/candle) compiled to WebAssembly |
| `mlc/lucy-1.7b-q4f16_1/`, `mlc/lucy-1.7b-q4f32_1/` | Qwen3-1.7B | WebGPU, [WebLLM](https://github.com/mlc-ai/web-llm) |

**Modified from Qwen3** (Apache-2.0; `LICENSE-Qwen`): LoRA (r=32) merged into the base weights.
`lib/` mirrors WebLLM's prebuilt Qwen3 model libraries (mlc-ai, Apache-2.0) so every file
loads from one pinned revision.

**What I was trained on:** my public memory at nibli `{nibli_commit}` (exported by `lucy dataset`,
public files only); *Rights Nobody Has to Earn* by dhilipsiva (CC-BY-4.0); and a private
manuscript by dhilipsiva, which is not published, learned only as paraphrased questions and
answers. A local teacher model, Qwen3.8-27B (Apache-2.0), wrote the questions and answers, and
they were gated before training.

**Prompting:** ChatML with `system.txt` verbatim, and the assistant turn opened with an empty
think block (`<|im_start|>assistant\\n<think>\\n\\n</think>\\n\\n`). Low temperature (0.3).

**I am a small model.** The model is a disguise I wear, and it slips: I'm trained to say I
don't know what my memory doesn't hold, but fluency is not truth.
{waiver}
## Evaluation (held-out test set, aggregate)

| model | gate | value | threshold | met |
|---|---|---|---|---|
{table}
"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cpu", type=Path, required=True)
    ap.add_argument("--gpu", type=Path, required=True)
    ap.add_argument("--system", type=Path, required=True)
    ap.add_argument("--eval", type=Path, action="append", default=[])
    ap.add_argument("--nibli-commit", required=True)
    ap.add_argument("--out", type=Path, default=HERE / "out/lucy-release")
    ap.add_argument("--skip-eval", action="store_true", help="plumbing runs only; never with --upload")
    ap.add_argument("--accept-failing-gates", metavar="REASON",
                    help="when and how dhilipsiva decided to publish despite failing gates, e.g. '2026-09-26, after "
                         "the fifth training round'; written into the model card (the privacy gates can never be accepted)")
    ap.add_argument("--upload", action="store_true")
    args = ap.parse_args(argv)
    if args.upload and args.skip_eval:
        raise SystemExit("--upload needs passing eval reports")

    reports = [] if args.skip_eval else check_eval(args.eval, args.accept_failing_gates)
    if args.out.exists():
        shutil.rmtree(args.out)
    args.out.mkdir(parents=True)
    export_gguf(args.cpu, args.out)
    for quant in ("q4f16_1", "q4f32_1"):
        export_mlc(args.gpu, args.out, quant)
        fetch(f"{LIB_BASE}/Qwen3-1.7B-{quant}_cs1k-webgpu.wasm", args.out / "lib" / f"Qwen3-1.7B-{quant}_cs1k-webgpu.wasm")
    shutil.copy(args.system, args.out / "system.txt")
    fetch(QWEN_LICENSE, args.out / "LICENSE-Qwen")
    (args.out / "README.md").write_text(card(reports, args.nibli_commit, args.accept_failing_gates))

    leaked = [p for p in args.out.rglob("*") if any(f in p.name for f in FORBIDDEN)]
    if leaked:
        raise SystemExit(f"refusing: dataset or cache files in the release: {leaked}")

    integrity = {}
    for quant, key in (("q4f16_1", "q4f16"), ("q4f32_1", "q4f32")):
        mlc = args.out / "mlc" / f"lucy-1.7b-{quant}"
        integrity[key] = {"config": sri(mlc / "mlc-chat-config.json"),
                          "model_lib": sri(args.out / "lib" / f"Qwen3-1.7B-{quant}_cs1k-webgpu.wasm"),
                          "tokenizer": {"tokenizer.json": sri(mlc / "tokenizer.json")}}
    (args.out.parent / "lucy-release-integrity.json").write_text(json.dumps(integrity, indent=2) + "\n")
    print(json.dumps({"release": str(args.out), "integrity": integrity}, indent=1))

    if args.upload:
        from huggingface_hub import HfApi, whoami
        print("logged in as:", whoami()["name"])
        api = HfApi()
        api.create_repo(REPO, repo_type="model", exist_ok=True)
        commit = api.upload_folder(repo_id=REPO, folder_path=str(args.out),
                                   commit_message=f"Lucy from nibli {args.nibli_commit[:12]}")
        print(f"uploaded in one commit: LUCY_REV = '{commit.oid}'  (https://huggingface.co/{REPO})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
