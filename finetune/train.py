"""LoRA fine-tune into the dhilipsiva twin.

    python train.py                # SmolLM2-135M, persona only
    python train.py --base qwen    # Qwen2.5-0.5B, persona + MCP tool calls

Trains on the ChatML JSONL from generate_dataset.py, merges the adapter, and
saves a ready-to-convert HF model. On an RTX 5090 this takes minutes.
"""
import argparse
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)

HERE = Path(__file__).parent
BASES = {
    "smol": ("HuggingFaceTB/SmolLM2-135M-Instruct", "", "out/merged", 16),
    "qwen": ("Qwen/Qwen2.5-0.5B-Instruct", "qwen-", "out/merged-qwen", 8),
}
MAX_LEN = 512

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", choices=BASES, default="smol")
    BASE, PREFIX, OUT_DIR, BATCH = BASES[ap.parse_args().base]
    use_cuda = torch.cuda.is_available()
    dtype = torch.bfloat16 if use_cuda else torch.float32
    print(f"device: {'cuda - ' + torch.cuda.get_device_name(0) if use_cuda else 'cpu'}")

    tokenizer = AutoTokenizer.from_pretrained(BASE)
    model = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=dtype)
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
        msgs = row["messages"]
        prompt_text = tokenizer.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True)
        prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
        answer_ids = tokenizer(msgs[-1]["content"], add_special_tokens=False)["input_ids"] + [im_end]
        input_ids = (prompt_ids + answer_ids)[:MAX_LEN]
        labels = ([-100] * len(prompt_ids) + answer_ids)[:MAX_LEN]
        return {"input_ids": input_ids, "labels": labels, "attention_mask": [1] * len(input_ids)}

    data = load_dataset(
        "json",
        data_files={
            "train": str(HERE / f"data/{PREFIX}train.jsonl"),
            "eval": str(HERE / f"data/{PREFIX}eval.jsonl"),
        },
    )
    data = data.map(to_features, remove_columns=["messages"])

    args = TrainingArguments(
        output_dir=str(HERE / "out/checkpoints"),
        num_train_epochs=24,
        per_device_train_batch_size=BATCH if use_cuda else 2,
        gradient_accumulation_steps=1,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="no",
        bf16=use_cuda,
        report_to=[],
    )

    from transformers import DataCollatorForSeq2Seq
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=data["train"],
        eval_dataset=data["eval"],
        data_collator=DataCollatorForSeq2Seq(tokenizer, padding=True, label_pad_token_id=-100),
    )
    trainer.train()

    merged = model.merge_and_unload()
    out = HERE / OUT_DIR
    merged.save_pretrained(out)
    tokenizer.save_pretrained(out)
    print(f"merged model saved to {out}")

    # smoke generations — use the SAME system prompt the dataset trained with
    import json as _json
    system = _json.loads(
        (HERE / f"data/{PREFIX}train.jsonl").read_text(encoding="utf-8").splitlines()[0]
    )["messages"][0]["content"]
    merged.eval()
    for q in ["who are you?", "what is nibli?", "did you work at Google?",
              "show me your rust projects", "how do I contact you?"]:
        prompt = tokenizer.apply_chat_template(
            [{"role": "system", "content": system}, {"role": "user", "content": q}],
            tokenize=False,
            add_generation_prompt=True,
        )
        ids = tokenizer(prompt, return_tensors="pt").to(merged.device)
        with torch.no_grad():
            gen = merged.generate(**ids, max_new_tokens=90, do_sample=False,
                                  eos_token_id=im_end, pad_token_id=im_end)
        print(f"smoke[{q}]:", tokenizer.decode(gen[0][ids["input_ids"].shape[1]:], skip_special_tokens=True))

if __name__ == "__main__":
    main()
