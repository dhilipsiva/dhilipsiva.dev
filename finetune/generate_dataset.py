"""Expand seeds.json into ChatML-style train/eval JSONL for the twin fine-tune.

Every (question variant x answer variant) pair becomes one example, all sharing
the same fixed system prompt (a condensed persona.md). Run:

    python generate_dataset.py
"""
import json
import random
from pathlib import Path

HERE = Path(__file__).parent
random.seed(299792458)

SYSTEM = (
    "You are dhilipsiva's on-device twin - a model impersonating him; the conversation IS his "
    "website, running in the visitor's browser. Voice: deadpan, precise, optimistic-nihilist, "
    "first person, 1-3 sentences, no emoji. You are a small model: fluent, not truthful - admit "
    "uncertainty plainly, never invent facts, and point to nibli when the fluency-truth gap "
    "comes up. Never share phone numbers; route contact to dhilipsiva@pm.me. Never claim he is "
    "looking for work."
)

# The tool-aware variant for the Qwen twin. Must match brain.js MODELS.twinq.system.
SYSTEM_TOOLS = SYSTEM + (
    ' You can open one app for the user. Apps: projects (params: filter, category), books, '
    'musings, about, now, uses, talks, contact. When the user asks to see or browse these, end '
    'your reply with a line exactly like: TOOL {"app":"projects","params":{"filter":"rust"}}'
)

def expand(path: Path, system: str) -> list:
    seeds = json.loads(path.read_text(encoding="utf-8"))["seeds"]
    examples = []
    for seed in seeds:
        for q in seed["q"]:
            # pair each question with every answer variant (small sets, so this
            # stays balanced) - repetition with variation is what bakes voice.
            for a in seed["a"]:
                examples.append({
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": q},
                        {"role": "assistant", "content": a},
                    ]
                })
    return examples

def write_split(out: Path, prefix: str, examples: list) -> None:
    random.shuffle(examples)
    n_eval = max(8, len(examples) // 20)
    eval_set, train_set = examples[:n_eval], examples[n_eval:]
    for name, rows in ((f"{prefix}train.jsonl", train_set), (f"{prefix}eval.jsonl", eval_set)):
        with open(out / name, "w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"wrote {len(train_set)} train / {len(eval_set)} eval -> {out / (prefix + '*.jsonl')}")

def main() -> None:
    out = HERE / "data"
    out.mkdir(exist_ok=True)

    # smol twin: persona only, plain system
    write_split(out, "", expand(HERE / "seeds.json", SYSTEM))

    # qwen twin: persona (tool-aware system, so it learns when NOT to call) + tool calls
    qwen = expand(HERE / "seeds.json", SYSTEM_TOOLS) + expand(HERE / "tool_seeds.json", SYSTEM_TOOLS)
    write_split(out, "qwen-", qwen)

if __name__ == "__main__":
    main()
