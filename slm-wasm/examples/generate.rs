//! Native generation with the browser's exact runtime code, for evaluating the
//! GGUF a visitor downloads (finetune/lucy_eval.py --gguf drives it):
//!
//!     cargo run --release --example generate -- model.gguf tokenizer.json < in.jsonl > out.jsonl
//!
//! Input lines: {"prompt": "...", "temp": 0.3, "top_p": 0.9, "repeat_penalty": 1.05,
//! "max_tokens": 140, "seed": 1}. Output lines: {"text": "...", "capped": false}.
//! One line out per line in, flushed, so a caller can keep the process open.

use std::io::{BufRead, Write};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (Some(gguf), Some(tok)) = (args.get(1), args.get(2)) else {
        eprintln!("usage: generate MODEL.gguf TOKENIZER.json < prompts.jsonl");
        std::process::exit(2);
    };
    let gguf = std::fs::read(gguf).expect("read the GGUF");
    let tok = std::fs::read(tok).expect("read the tokenizer");
    let mut model = slm_wasm::Model::load(&gguf, &tok).expect("load the model");
    drop(gguf);
    let mut out = std::io::stdout().lock();
    for line in std::io::stdin().lock().lines() {
        let line = line.expect("read stdin");
        if line.trim().is_empty() {
            continue;
        }
        let v: serde_json::Value = serde_json::from_str(&line).expect("a JSON line");
        let (text, capped) = model
            .complete(
                v["prompt"].as_str().expect("prompt"),
                v["temp"].as_f64().unwrap_or(0.0),
                v["top_p"].as_f64().unwrap_or(0.0),
                v["repeat_penalty"].as_f64().unwrap_or(1.0) as f32,
                v["max_tokens"].as_u64().unwrap_or(140) as usize,
                v["seed"].as_u64().unwrap_or(1),
            )
            .expect("generate");
        writeln!(out, "{}", serde_json::json!({ "text": text, "capped": capped })).expect("write");
        out.flush().expect("flush");
    }
}
