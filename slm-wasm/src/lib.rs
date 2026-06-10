//! In-browser SLM inference for dhilipsiva.com/play.
//! candle (Rust) compiled to WebAssembly — quantized llama-architecture GGUF
//! (SmolLM2-135M-Instruct), single-threaded, simd128.
//!
//! Pattern follows candle-wasm-examples/quant-qwen3 (m.rs) with the
//! quantized_llama loader. Streaming contract: `init_with_prompt` prefills and
//! returns the first text piece; `next_token` returns one piece per call and
//! the empty string once EOS / the token budget is reached (`is_eos`).

use std::io::Cursor;

use candle::quantized::gguf_file;
use candle::{DType, Device, Tensor};
use candle_transformers::generation::LogitsProcessor;
use candle_transformers::models::quantized_llama::ModelWeights;
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

fn jserr<E: std::fmt::Display>(e: E) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen]
pub struct Model {
    model: ModelWeights,
    tokenizer: Tokenizer,
    logits_processor: LogitsProcessor,
    tokens: Vec<u32>,
    prompt_len: usize,
    emitted: String,
    eos_tokens: Vec<u32>,
    repeat_penalty: f32,
    repeat_last_n: usize,
    index_pos: usize,
    max_tokens: usize,
    generated: usize,
    eos_hit: bool,
}

#[wasm_bindgen]
impl Model {
    #[wasm_bindgen(constructor)]
    pub fn new(gguf: Vec<u8>, tokenizer_json: Vec<u8>) -> Result<Model, JsError> {
        console_error_panic_hook::set_once();
        let device = Device::Cpu;

        let mut cursor = Cursor::new(&gguf);
        let content = gguf_file::Content::read(&mut cursor).map_err(jserr)?;
        let model = ModelWeights::from_gguf(content, &mut cursor, &device).map_err(jserr)?;

        let tokenizer = Tokenizer::from_bytes(&tokenizer_json).map_err(jserr)?;
        let eos_tokens: Vec<u32> = ["<|im_end|>", "<|endoftext|>"]
            .iter()
            .filter_map(|t| tokenizer.token_to_id(t))
            .collect();

        Ok(Self {
            model,
            tokenizer,
            logits_processor: LogitsProcessor::new(0, None, None),
            tokens: Vec::new(),
            prompt_len: 0,
            emitted: String::new(),
            eos_tokens,
            repeat_penalty: 1.0,
            repeat_last_n: 64,
            index_pos: 0,
            max_tokens: 0,
            generated: 0,
            eos_hit: false,
        })
    }

    /// Prefill the (ChatML) prompt and sample the first token.
    /// Returns the first decoded text piece (may be empty).
    #[allow(clippy::too_many_arguments)]
    pub fn init_with_prompt(
        &mut self,
        prompt: String,
        temp: f64,
        top_p: f64,
        repeat_penalty: f32,
        max_tokens: usize,
        seed: u64,
    ) -> Result<String, JsError> {
        let temp = if temp <= 0.0 { None } else { Some(temp) };
        let top_p = if top_p <= 0.0 || top_p >= 1.0 { None } else { Some(top_p) };
        self.logits_processor = LogitsProcessor::new(seed, temp, top_p);
        self.repeat_penalty = repeat_penalty;
        self.max_tokens = max_tokens.max(1);
        self.generated = 0;
        self.eos_hit = false;
        self.emitted = String::new();

        let encoding = self.tokenizer.encode(prompt, true).map_err(jserr)?;
        let prompt_tokens = encoding.get_ids().to_vec();
        if prompt_tokens.is_empty() {
            return Err(JsError::new("empty prompt after tokenization"));
        }
        self.prompt_len = prompt_tokens.len();
        self.tokens = prompt_tokens;

        let input = Tensor::new(self.tokens.as_slice(), &Device::Cpu)
            .map_err(jserr)?
            .unsqueeze(0)
            .map_err(jserr)?;
        let logits = self.model.forward(&input, 0).map_err(jserr)?;
        let logits = logits.squeeze(0).map_err(jserr)?;
        self.index_pos = self.tokens.len();

        self.sample(&logits)?;
        Ok(self.decode_delta())
    }

    /// One decode step. Empty string when finished (check `is_eos`).
    pub fn next_token(&mut self) -> Result<String, JsError> {
        if self.eos_hit || self.generated >= self.max_tokens {
            self.eos_hit = true;
            return Ok(String::new());
        }
        let last = *self.tokens.last().expect("tokens never empty after init");
        let input = Tensor::new(&[last], &Device::Cpu)
            .map_err(jserr)?
            .unsqueeze(0)
            .map_err(jserr)?;
        let logits = self.model.forward(&input, self.index_pos).map_err(jserr)?;
        let logits = logits.squeeze(0).map_err(jserr)?;
        self.index_pos += 1;

        self.sample(&logits)?;
        Ok(self.decode_delta())
    }

    pub fn is_eos(&self) -> bool {
        self.eos_hit
    }
}

impl Model {
    fn sample(&mut self, logits: &Tensor) -> Result<(), JsError> {
        let logits = logits.to_dtype(DType::F32).map_err(jserr)?;
        let logits = if self.repeat_penalty == 1.0 {
            logits
        } else {
            let start = self.tokens.len().saturating_sub(self.repeat_last_n);
            candle_transformers::utils::apply_repeat_penalty(
                &logits,
                self.repeat_penalty,
                &self.tokens[start..],
            )
            .map_err(jserr)?
        };
        let next = self.logits_processor.sample(&logits).map_err(jserr)?;
        self.tokens.push(next);
        self.generated += 1;
        if self.eos_tokens.contains(&next) {
            self.eos_hit = true;
        }
        Ok(())
    }

    /// Decode all generated tokens and return only the not-yet-emitted suffix.
    /// Withholds output while the decode ends in a partial UTF-8 sequence (�).
    fn decode_delta(&mut self) -> String {
        let generated = &self.tokens[self.prompt_len..];
        let full = self
            .tokenizer
            .decode(generated, true)
            .unwrap_or_default();
        if full.ends_with('\u{FFFD}') || full.len() <= self.emitted.len() {
            return String::new();
        }
        let delta = full[self.emitted.len()..].to_string();
        self.emitted = full;
        delta
    }
}
