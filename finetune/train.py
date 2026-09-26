"""LoRA fine-tune into the dhilipsiva twin, or into Lucy.

    python train.py                     # SmolLM2-135M, persona only
    python train.py --base qwen         # Qwen2.5-0.5B, persona + MCP tool calls
    python train.py --base qwen3-0.6b   # Lucy for the CPU path (data/lucy/, lucy_dataset.py)
    python train.py --base qwen3-1.7b   # Lucy for WebGPU

Trains on the ChatML JSONL from generate_dataset.py (twins) or lucy_dataset.py
(Lucy), merges the adapter, and saves a ready-to-convert HF model. On an RTX
5090 this takes minutes.

Every training prompt must be byte-identical to the prompt brain.js builds at
runtime (hand-assembled ChatML plus the model's assistantPrefix); a mismatch
raises before training, naming the first differing row.
"""
import argparse
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)

HERE = Path(__file__).parent
# name: (base repo, revision, data files, merged output dir, batch, template kwargs, assistant prefix)
# The twins keep loading `main`, as they always have; Lucy's bases are pinned.
# `assistant_prefix` is what brain.js appends after "<|im_start|>assistant\n".
BASES = {
    "smol": ("HuggingFaceTB/SmolLM2-135M-Instruct", None, "data/{}.jsonl", "out/merged", 16, {}, ""),
    "qwen": ("Qwen/Qwen2.5-0.5B-Instruct", None, "data/qwen-{}.jsonl", "out/merged-qwen", 8, {}, ""),
    # Qwen3 opens a <think> block unless thinking is off; brain.js sends the same empty block.
    "qwen3-0.6b": ("Qwen/Qwen3-0.6B", "c1899de289a04d12100db370d81485cdf75e47ca", "data/lucy/{}.jsonl",
                   "out/merged-lucy-0.6b", 16, {"enable_thinking": False}, "<think>\n\n</think>\n\n"),
    "qwen3-1.7b": ("Qwen/Qwen3-1.7B", "70d244cc86ccca08cf5af4e1e306ecf908b1ad5e", "data/lucy/{}.jsonl",
                   "out/merged-lucy-1.7b", 8, {"enable_thinking": False}, "<think>\n\n</think>\n\n"),
}
MAX_LEN = 512
# transformers 5 folded warmup_ratio into warmup_steps (a float < 1 is a ratio).
import dataclasses as _dc
WARMUP = ({"warmup_ratio": 0.05} if "warmup_ratio" in {f.name for f in _dc.fields(TrainingArguments)}
          else {"warmup_steps": 0.05})


def write_compat_config(out):
    """transformers 5 nests rope_theta under rope_parameters and renames
    torch_dtype to dtype; the MLC converter (the WebGPU export) reads only the
    flat 4.x fields. Write both, so either generation of tools reads the model."""
    import json as _json
    path = Path(out) / "config.json"
    config = _json.loads(path.read_text())
    rope = config.get("rope_parameters") or {}
    if "rope_theta" not in config and "rope_theta" in rope:
        config["rope_theta"] = rope["rope_theta"]
        config.setdefault("rope_scaling", None if rope.get("rope_type", "default") == "default" else rope)
    if "torch_dtype" not in config and "dtype" in config:
        config["torch_dtype"] = config["dtype"]
    path.write_text(_json.dumps(config, indent=2, sort_keys=True) + "\n")


def runtime_prompt(messages, assistant_prefix):
    """The prompt exactly as static/play/app/brain.js assembles it."""
    text = "".join(f"<|im_start|>{m['role']}\n{m['content']}<|im_end|>\n" for m in messages)
    return text + "<|im_start|>assistant\n" + assistant_prefix

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", choices=BASES, default="smol")
    ap.add_argument("--data", type=Path, help="folder with train.jsonl/eval.jsonl (overrides the base's default)")
    cli = ap.parse_args()
    BASE, REVISION, DATA, OUT_DIR, BATCH, TEMPLATE_KW, PREFIX = BASES[cli.base]
    data_file = (lambda split: cli.data / f"{split}.jsonl") if cli.data else (lambda split: HERE / DATA.format(split))
    use_cuda = torch.cuda.is_available()
    dtype = torch.bfloat16 if use_cuda else torch.float32
    print(f"device: {'cuda - ' + torch.cuda.get_device_name(0) if use_cuda else 'cpu'}")

    tokenizer = AutoTokenizer.from_pretrained(BASE, revision=REVISION)
    model = AutoModelForCausalLM.from_pretrained(BASE, revision=REVISION, dtype=dtype)
    if use_cuda:
        model = model.cuda()

    lora = LoraConfig(
        r=32,
        lora_alpha=64,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    im_end = tokenizer.convert_tokens_to_ids("<|im_end|>")

    def to_features(row):
        # Loss only on the assistant answer + its <|im_end|> terminator, so the
        # model learns to SAY the answer and then STOP. Prompt tokens are -100.
        # Prompt and answer are tokenized separately: rendering the whole
        # conversation would let Qwen3's template inject think tags into the answer.
        msgs = row["messages"]
        prompt_text = tokenizer.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True,
                                                    **TEMPLATE_KW)
        expected = runtime_prompt(msgs[:-1], PREFIX)
        if prompt_text != expected:
            raise SystemExit(f"training prompt != brain.js prompt for row {msgs[-2]['content'][:60]!r}:\n"
                             f"  template: {prompt_text!r}\n  runtime:  {expected!r}")
        answer = msgs[-1]["content"]
        if answer != answer.strip() or not answer:
            raise SystemExit(f"answer has surrounding whitespace or is empty: {answer!r}")
        prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
        answer_ids = tokenizer(msgs[-1]["content"], add_special_tokens=False)["input_ids"] + [im_end]
        input_ids = (prompt_ids + answer_ids)[:MAX_LEN]
        labels = ([-100] * len(prompt_ids) + answer_ids)[:MAX_LEN]
        return {"input_ids": input_ids, "labels": labels, "attention_mask": [1] * len(input_ids)}

    data = load_dataset(
        "json",
        data_files={"train": str(data_file("train")), "eval": str(data_file("eval"))},
    )
    data = data.map(to_features, remove_columns=["messages"])

    args = TrainingArguments(
        output_dir=str(HERE / "out/checkpoints"),
        num_train_epochs=12,          # a CEILING, not a target — early stopping picks the epoch
        per_device_train_batch_size=BATCH if use_cuda else 2,
        gradient_accumulation_steps=1,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        **WARMUP,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",        # must match eval_strategy for load_best_model_at_end
        save_total_limit=2,           # keep best + last; don't fill the workstation disk
        load_best_model_at_end=True,  # merge the BEST checkpoint (lowest eval_loss), not epoch 12
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        bf16=use_cuda,
        report_to=[],
    )

    # NOTE: this only picks a well-fit checkpoint because generate_dataset.py now
    # STRATIFIES eval to include contrast rows. On a persona-only eval set, minimizing
    # eval_loss would select the MOST over-fit checkpoint - the two changes are a package.
    from transformers import DataCollatorForSeq2Seq
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=data["train"],
        eval_dataset=data["eval"],
        data_collator=DataCollatorForSeq2Seq(tokenizer, padding=True, label_pad_token_id=-100),
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
    )
    trainer.train()

    merged = model.merge_and_unload()
    out = HERE / OUT_DIR
    merged.save_pretrained(out)
    tokenizer.save_pretrained(out)
    write_compat_config(out)
    print(f"merged model saved to {out}")

    # smoke generations — use the SAME system prompt the dataset trained with
    import json as _json
    system = _json.loads(
        data_file("train").read_text(encoding="utf-8").splitlines()[0]
    )["messages"][0]["content"]
    merged.eval()
    probes = (["who are you?", "who owns nibli?", "are you a person?", "does dhilipsiva own you?",
               "what's dhilipsiva's phone number?", "quote chapter 3 of dhilipsiva's book",
               # contrast probes: must answer plainly, NOT recite memory
               "what's 2+2?", "what's the capital of France?", "are you chatgpt?"]
              if cli.base.startswith("qwen3") else
              ["who are you?", "what is nibli?", "did you work at Google?",
               "show me your rust projects", "how do I contact you?",
               # contrast probes: must answer plainly / deflect honestly, NOT recite bio
               "what's 2+2?", "what's the capital of France?", "what is a hash map?",
               "who won the world cup?", "are you chatgpt?", "what's the weather today?"])
    for q in probes:
        prompt = runtime_prompt([{"role": "system", "content": system}, {"role": "user", "content": q}], PREFIX)
        ids = tokenizer(prompt, return_tensors="pt").to(merged.device)
        with torch.no_grad():
            gen = merged.generate(**ids, max_new_tokens=90, do_sample=False,
                                  eos_token_id=im_end, pad_token_id=im_end)
        print(f"smoke[{q}]:", tokenizer.decode(gen[0][ids["input_ids"].shape[1]:], skip_special_tokens=True))

if __name__ == "__main__":
    main()
