"""Merge one training checkpoint's LoRA adapter into its base, to evaluate an
epoch other than the one train.py merged (train.py --keep-every-epoch).

    python merge_checkpoint.py --base qwen3-1.7b --checkpoint out/checkpoints-qwen3-1.7b/checkpoint-2790 \\
        --out out/merged-lucy-1.7b-e2
"""
import argparse
import importlib.util
import sys
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

HERE = Path(__file__).parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--checkpoint", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    spec = importlib.util.spec_from_file_location("train", HERE / "train.py")
    train = importlib.util.module_from_spec(spec)
    sys.argv = ["train.py"]
    spec.loader.exec_module(train)
    repo, revision = train.BASES[args.base][0], train.BASES[args.base][1]
    base = AutoModelForCausalLM.from_pretrained(repo, revision=revision, dtype=torch.bfloat16)
    merged = PeftModel.from_pretrained(base, str(args.checkpoint)).merge_and_unload()
    merged.save_pretrained(args.out)
    AutoTokenizer.from_pretrained(repo, revision=revision).save_pretrained(args.out)
    train.write_compat_config(args.out)
    print(f"merged {args.checkpoint} -> {args.out}")


if __name__ == "__main__":
    main()
