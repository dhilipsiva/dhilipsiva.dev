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
    "looking for work. Answer general questions plainly and briefly; only bring up dhilipsiva "
    "when the question is actually about him or his work."
)

# The tool-aware variant for the Qwen twin. Must match brain.js MODELS.twinq.system.
SYSTEM_TOOLS = SYSTEM + (
    ' You can open one app for the user. Apps: projects (params: filter, category), books, '
    'musings, about, now, uses, talks, contact. When the user asks to see or browse these, end '
    'your reply with a line exactly like: TOOL {"app":"projects","params":{"filter":"rust"}}'
)

def expand(path: Path, system: str, origin: str = "persona") -> list:
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
                    ],
                    # tag so write_split can guarantee contrast rows land in eval;
                    # stripped before the JSONL is written (train.py never sees it).
                    "_origin": origin,
                })
    return examples

def expand_multi(path: Path, system: str) -> list:
    """Multi-turn seeds: turns = [[user, assistant], ...]. The whole conversation
    becomes ONE example; train.py masks everything but the final assistant turn,
    so earlier turns are pure context (use canonical single-turn answers there)."""
    seeds = json.loads(path.read_text(encoding="utf-8"))["seeds"]
    examples = []
    for seed in seeds:
        messages = [{"role": "system", "content": system}]
        for user, assistant in seed["turns"]:
            messages.append({"role": "user", "content": user})
            messages.append({"role": "assistant", "content": assistant})
        examples.append({"messages": messages, "_origin": "persona"})
    return examples

def write_split(out: Path, prefix: str, examples: list, contrast_frac_in_eval: float = 0.35) -> None:
    # Stratify: force a fixed share of CONTRAST rows into eval so eval_loss finally
    # measures general-question behaviour (a pure-random slice of a mostly-persona
    # pool goes down monotonically while the twin over-fits - it can't see that).
    # This is what makes train.py's load_best_model_at_end=eval_loss select for
    # BOTH persona recall and general behaviour instead of maximal over-fit.
    random.shuffle(examples)
    contrast = [e for e in examples if e.get("_origin") == "contrast"]
    persona = [e for e in examples if e.get("_origin") != "contrast"]
    n_eval = max(12, len(examples) // 20)
    n_eval_contra = min(len(contrast), max(6, int(n_eval * contrast_frac_in_eval)))
    n_eval_pers = min(len(persona), n_eval - n_eval_contra)
    eval_set = contrast[:n_eval_contra] + persona[:n_eval_pers]
    train_set = contrast[n_eval_contra:] + persona[n_eval_pers:]
    random.shuffle(eval_set)
    random.shuffle(train_set)
    for row in eval_set + train_set:
        row.pop("_origin", None)  # strip before write; train.py reads only "messages"
    for name, rows in ((f"{prefix}train.jsonl", train_set), (f"{prefix}eval.jsonl", eval_set)):
        with open(out / name, "w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"wrote {len(train_set)} train / {len(eval_set)} eval "
          f"({n_eval_contra} contrast in eval) -> {out / (prefix + '*.jsonl')}")

def main() -> None:
    out = HERE / "data"
    out.mkdir(exist_ok=True)

    # smol twin: persona + contrast (general mode) + multi-turn context-following
    smol = (expand(HERE / "seeds.json", SYSTEM)
            + expand(HERE / "contrast_seeds.json", SYSTEM, origin="contrast")
            + expand_multi(HERE / "multi_seeds.json", SYSTEM))
    write_split(out, "", smol)

    # qwen twin: persona (tool-aware system, so it learns when NOT to call) + contrast
    # (also teaches it NOT to emit TOOL on general questions) + tool calls + multi-turn
    # (incl. conversations that END in a contextual TOOL call)
    qwen = (expand(HERE / "seeds.json", SYSTEM_TOOLS)
            + expand(HERE / "contrast_seeds.json", SYSTEM_TOOLS, origin="contrast")
            + expand(HERE / "tool_seeds.json", SYSTEM_TOOLS)
            + expand_multi(HERE / "multi_seeds.json", SYSTEM_TOOLS)
            + expand_multi(HERE / "tool_multi_seeds.json", SYSTEM_TOOLS))
    write_split(out, "qwen-", qwen)

if __name__ == "__main__":
    main()
