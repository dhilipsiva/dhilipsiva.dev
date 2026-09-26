//! In-browser inference for dhilipsiva.dev — candle (Rust) compiled to
//! WebAssembly. Two engines behind one small surface:
//!
//! * [`Model`] — quantized chat LLM (GGUF). The architecture is read from the
//!   GGUF metadata and dispatched automatically: `llama` (SmolLM2 et al),
//!   `qwen2` (Qwen2.5) or `qwen3` (Qwen3). Streaming contract:
//!   `init_with_prompt` prefills and returns the first text piece;
//!   `next_token` returns one piece per call and the empty string once EOS /
//!   the token budget is reached (`is_eos`).
//! * [`Whisper`] — quantized speech-to-text (whisper tiny.en, GGUF). Takes
//!   16kHz mono f32 PCM, returns the transcript. Greedy decode, ported from
//!   candle-wasm-examples/whisper.
//!
//! Single-threaded + simd128 — no COOP/COEP headers needed anywhere.

use std::io::Cursor;

use candle::quantized::gguf_file;
use candle::{DType, Device, IndexOp, Tensor, D};
use candle_nn::ops::softmax;
use candle_transformers::generation::LogitsProcessor;
use candle_transformers::models::quantized_llama;
use candle_transformers::models::quantized_qwen2;
use candle_transformers::models::quantized_qwen3;
use candle_transformers::models::whisper::{self as wm, quantized_model, Config as WhisperConfig};
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

// Single-threaded mel-spectrogram (vendored from candle-wasm-examples/whisper).
// candle-transformers' own audio module spawns std threads, which trap on wasm.
mod audio;

/* ════════════════════════════════════════════════════════════════════════
   Chat LLM — llama / qwen2 / qwen3 GGUF, auto-detected
   ════════════════════════════════════════════════════════════════════════ */

enum Arch {
    Llama(quantized_llama::ModelWeights),
    Qwen2(quantized_qwen2::ModelWeights),
    Qwen3(quantized_qwen3::ModelWeights),
}

impl Arch {
    fn forward(&mut self, x: &Tensor, index_pos: usize) -> candle::Result<Tensor> {
        match self {
            Arch::Llama(m) => m.forward(x, index_pos),
            Arch::Qwen2(m) => m.forward(x, index_pos),
            Arch::Qwen3(m) => {
                // llama/qwen2 reset their KV cache when a prompt starts at position
                // 0; candle's qwen3 cache only appends. Without this clear, the
                // second question's mask no longer matches the cache and fails.
                if index_pos == 0 {
                    m.clear_kv_cache();
                }
                m.forward(x, index_pos)
            }
        }
    }
}

#[wasm_bindgen]
pub struct Model {
    model: Arch,
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
        Self::new_inner(&gguf, &tokenizer_json).map_err(|e| JsError::new(&e))
    }

    /// Prefill the (ChatML) prompt and sample the first token.
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
        self.init_inner(prompt, temp, top_p, repeat_penalty, max_tokens, seed)
            .map_err(|e| JsError::new(&e))
    }

    /// One decode step. Empty string when finished (check `is_eos`).
    pub fn next_token(&mut self) -> Result<String, JsError> {
        self.next_inner().map_err(|e| JsError::new(&e))
    }

    pub fn is_eos(&self) -> bool {
        self.eos_hit
    }
}

// The work lives in `_inner` methods with String errors (as `Whisper` does), so
// native tests can drive a model: a JsError cannot be built off wasm32.
impl Model {
    /// Native use (evaluation harnesses): load a model exactly as the browser does.
    pub fn load(gguf: &[u8], tokenizer_json: &[u8]) -> Result<Model, String> {
        Self::new_inner(gguf, tokenizer_json)
    }

    /// Native use: one whole generation through the same sampling path the
    /// browser streams token by token. Returns the text and whether it was cut
    /// off by `max_tokens` rather than ending on an end-of-turn token.
    pub fn complete(
        &mut self,
        prompt: &str,
        temp: f64,
        top_p: f64,
        repeat_penalty: f32,
        max_tokens: usize,
        seed: u64,
    ) -> Result<(String, bool), String> {
        let mut text = self.init_inner(prompt.to_string(), temp, top_p, repeat_penalty, max_tokens, seed)?;
        while !self.eos_hit {
            text.push_str(&self.next_inner()?);
        }
        let ended = self.tokens.last().is_some_and(|t| self.eos_tokens.contains(t));
        Ok((text, !ended))
    }

    fn new_inner(gguf: &[u8], tokenizer_json: &[u8]) -> Result<Model, String> {
        let device = Device::Cpu;

        let mut cursor = Cursor::new(gguf);
        let mut content = gguf_file::Content::read(&mut cursor).map_err(|e| e.to_string())?;
        let arch = content
            .metadata
            .get("general.architecture")
            .and_then(|v| v.to_string().ok())
            .cloned()
            .unwrap_or_else(|| "llama".to_string());
        let model = match arch.as_str() {
            "qwen2" => Arch::Qwen2(
                quantized_qwen2::ModelWeights::from_gguf(content, &mut cursor, &device)
                    .map_err(|e| e.to_string())?,
            ),
            "qwen3" => {
                // candle builds qwen3's RoPE tables and mask in f16 unless the GGUF
                // says otherwise (llama.cpp's converter never does). Ask for f32:
                // activations are f32 on the CPU, so this also skips a per-step cast.
                content
                    .metadata
                    .insert("general.dtype".to_string(), gguf_file::Value::U32(0));
                Arch::Qwen3(
                    quantized_qwen3::ModelWeights::from_gguf(content, &mut cursor, &device)
                        .map_err(|e| e.to_string())?,
                )
            }
            _ => Arch::Llama(
                quantized_llama::ModelWeights::from_gguf(content, &mut cursor, &device)
                    .map_err(|e| e.to_string())?,
            ),
        };

        let tokenizer = Tokenizer::from_bytes(tokenizer_json).map_err(|e| e.to_string())?;
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

    fn init_inner(
        &mut self,
        prompt: String,
        temp: f64,
        top_p: f64,
        repeat_penalty: f32,
        max_tokens: usize,
        seed: u64,
    ) -> Result<String, String> {
        let temp = if temp <= 0.0 { None } else { Some(temp) };
        let top_p = if top_p <= 0.0 || top_p >= 1.0 { None } else { Some(top_p) };
        self.logits_processor = LogitsProcessor::new(seed, temp, top_p);
        self.repeat_penalty = repeat_penalty;
        self.max_tokens = max_tokens.max(1);
        self.generated = 0;
        self.eos_hit = false;
        self.emitted = String::new();

        let encoding = self.tokenizer.encode(prompt, true).map_err(|e| e.to_string())?;
        let prompt_tokens = encoding.get_ids().to_vec();
        if prompt_tokens.is_empty() {
            return Err("empty prompt after tokenization".to_string());
        }
        self.prompt_len = prompt_tokens.len();
        self.tokens = prompt_tokens;

        let input = Tensor::new(self.tokens.as_slice(), &Device::Cpu)
            .and_then(|t| t.unsqueeze(0))
            .map_err(|e| e.to_string())?;
        let logits = self
            .model
            .forward(&input, 0)
            .and_then(|l| l.squeeze(0))
            .map_err(|e| e.to_string())?;
        self.index_pos = self.tokens.len();

        self.sample(&logits)?;
        Ok(self.decode_delta())
    }

    fn next_inner(&mut self) -> Result<String, String> {
        if self.eos_hit || self.generated >= self.max_tokens {
            self.eos_hit = true;
            return Ok(String::new());
        }
        let last = *self.tokens.last().expect("tokens never empty after init");
        let input = Tensor::new(&[last], &Device::Cpu)
            .and_then(|t| t.unsqueeze(0))
            .map_err(|e| e.to_string())?;
        let logits = self
            .model
            .forward(&input, self.index_pos)
            .and_then(|l| l.squeeze(0))
            .map_err(|e| e.to_string())?;
        self.index_pos += 1;

        self.sample(&logits)?;
        Ok(self.decode_delta())
    }

    fn sample(&mut self, logits: &Tensor) -> Result<(), String> {
        let logits = logits.to_dtype(DType::F32).map_err(|e| e.to_string())?;
        let logits = if self.repeat_penalty == 1.0 {
            logits
        } else {
            // Penalize only GENERATED tokens — never the prompt. Otherwise a
            // persona prompt full of the owner's name punishes the model for
            // saying its own name.
            let start = self
                .tokens
                .len()
                .saturating_sub(self.repeat_last_n)
                .max(self.prompt_len);
            candle_transformers::utils::apply_repeat_penalty(
                &logits,
                self.repeat_penalty,
                &self.tokens[start..],
            )
            .map_err(|e| e.to_string())?
        };
        let next = self.logits_processor.sample(&logits).map_err(|e| e.to_string())?;
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
        let full = self.tokenizer.decode(generated, true).unwrap_or_default();
        if full.ends_with('\u{FFFD}') || full.len() <= self.emitted.len() {
            return String::new();
        }
        let delta = full[self.emitted.len()..].to_string();
        self.emitted = full;
        delta
    }
}

/* ════════════════════════════════════════════════════════════════════════
   Whisper STT — quantized tiny.en, greedy decode
   (port of candle-wasm-examples/whisper, single temperature, no rng)
   ════════════════════════════════════════════════════════════════════════ */

const MEL_FILTERS_BYTES: &[u8] = include_bytes!("melfilters.bytes");

#[wasm_bindgen]
pub struct Whisper {
    model: quantized_model::Whisper,
    tokenizer: Tokenizer,
    mel_filters: Vec<f32>,
    suppress_tokens: Tensor,
    sot_token: u32,
    transcribe_token: u32,
    eot_token: u32,
    no_speech_token: u32,
    no_timestamps_token: u32,
}

fn token_id(tokenizer: &Tokenizer, token: &str) -> Result<u32, String> {
    tokenizer
        .token_to_id(token)
        .ok_or_else(|| format!("no token-id for {token}"))
}

#[wasm_bindgen]
impl Whisper {
    #[wasm_bindgen(constructor)]
    pub fn new(
        model_gguf: Vec<u8>,
        tokenizer_json: Vec<u8>,
        config_json: Vec<u8>,
    ) -> Result<Whisper, JsError> {
        console_error_panic_hook::set_once();
        Self::new_inner(&model_gguf, &tokenizer_json, &config_json).map_err(|e| JsError::new(&e))
    }

    /// Transcribe 16kHz mono f32 PCM. Returns the joined transcript.
    pub fn transcribe(&mut self, pcm: Vec<f32>) -> Result<String, JsError> {
        self.transcribe_inner(&pcm).map_err(|e| JsError::new(&e))
    }
}

impl Whisper {
    fn new_inner(model_gguf: &[u8], tokenizer_json: &[u8], config_json: &[u8]) -> Result<Whisper, String> {
        let device = Device::Cpu;

        let config: WhisperConfig = serde_json::from_slice(config_json).map_err(|e| e.to_string())?;
        let vb = candle_transformers::quantized_var_builder::VarBuilder::from_gguf_buffer(
            model_gguf,
            &device,
        )
        .map_err(|e| e.to_string())?;
        let model = quantized_model::Whisper::load(&vb, config).map_err(|e| e.to_string())?;

        let tokenizer = Tokenizer::from_bytes(tokenizer_json).map_err(|e| e.to_string())?;

        let mut mel_filters = vec![0f32; MEL_FILTERS_BYTES.len() / 4];
        for (i, chunk) in MEL_FILTERS_BYTES.chunks_exact(4).enumerate() {
            mel_filters[i] = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        }

        let suppress: Vec<f32> = (0..model.config.vocab_size as u32)
            .map(|i| {
                if model.config.suppress_tokens.contains(&i) {
                    f32::NEG_INFINITY
                } else {
                    0f32
                }
            })
            .collect();
        let suppress_tokens = Tensor::new(suppress.as_slice(), &device).map_err(|e| e.to_string())?;

        let sot_token = token_id(&tokenizer, wm::SOT_TOKEN)?;
        let transcribe_token = token_id(&tokenizer, wm::TRANSCRIBE_TOKEN)?;
        let eot_token = token_id(&tokenizer, wm::EOT_TOKEN)?;
        let no_timestamps_token = token_id(&tokenizer, wm::NO_TIMESTAMPS_TOKEN)?;
        let no_speech_token = wm::NO_SPEECH_TOKENS
            .iter()
            .find_map(|token| tokenizer.token_to_id(token))
            .ok_or_else(|| "unable to find any no-speech token".to_string())?;

        Ok(Self {
            model,
            tokenizer,
            mel_filters,
            suppress_tokens,
            sot_token,
            transcribe_token,
            eot_token,
            no_speech_token,
            no_timestamps_token,
        })
    }

    fn transcribe_inner(&mut self, pcm: &[f32]) -> Result<String, String> {
        let device = Device::Cpu;
        let mel = audio::pcm_to_mel(&self.model.config, pcm, &self.mel_filters).map_err(|e| e.to_string())?;
        let mel_len = mel.len();
        let n_mels = self.model.config.num_mel_bins;
        let mel = Tensor::from_vec(mel, (1, n_mels, mel_len / n_mels), &device).map_err(|e| e.to_string())?;

        let (_, _, content_frames) = mel.dims3().map_err(|e| e.to_string())?;
        let mut seek = 0;
        let mut out = String::new();
        while seek < content_frames {
            let segment_size = usize::min(content_frames - seek, wm::N_FRAMES);
            let mel_segment = mel.narrow(2, seek, segment_size).map_err(|e| e.to_string())?;
            seek += segment_size;
            let (text, no_speech_prob, avg_logprob) = self.decode_segment(&mel_segment)?;
            if no_speech_prob > wm::NO_SPEECH_THRESHOLD && avg_logprob < wm::LOGPROB_THRESHOLD {
                continue; // silence
            }
            if !out.is_empty() && !text.is_empty() {
                out.push(' ');
            }
            out.push_str(text.trim());
        }
        Ok(out.trim().to_string())
    }

    /// Greedy decode of one ≤30s mel segment → (text, no_speech_prob, avg_logprob).
    fn decode_segment(&mut self, mel: &Tensor) -> Result<(String, f64, f64), String> {
        let s = |e: candle::Error| e.to_string();
        let audio_features = self.model.encoder.forward(mel, true).map_err(s)?;
        let sample_len = self.model.config.max_target_positions / 2;
        let mut sum_logprob = 0f64;
        let mut no_speech_prob = f64::NAN;
        // tiny.en is English-only: no language token
        let mut tokens = vec![self.sot_token, self.transcribe_token, self.no_timestamps_token];
        for i in 0..sample_len {
            let tokens_t = Tensor::new(tokens.as_slice(), mel.device())
                .map_err(s)?
                .unsqueeze(0)
                .map_err(s)?;
            let ys = self
                .model
                .decoder
                .forward(&tokens_t, &audio_features, i == 0)
                .map_err(s)?;

            if i == 0 {
                let logits = self
                    .model
                    .decoder
                    .final_linear(&ys.i(..1).map_err(s)?)
                    .map_err(s)?
                    .i(0)
                    .map_err(s)?
                    .i(0)
                    .map_err(s)?;
                no_speech_prob = softmax(&logits, 0)
                    .map_err(s)?
                    .i(self.no_speech_token as usize)
                    .map_err(s)?
                    .to_scalar::<f32>()
                    .map_err(s)? as f64;
            }

            let (_, seq_len, _) = ys.dims3().map_err(s)?;
            let logits = self
                .model
                .decoder
                .final_linear(&ys.i((..1, seq_len - 1..)).map_err(s)?)
                .map_err(s)?
                .i(0)
                .map_err(s)?
                .i(0)
                .map_err(s)?;
            let logits = logits.broadcast_add(&self.suppress_tokens).map_err(s)?;

            let logits_v: Vec<f32> = logits.to_vec1().map_err(s)?;
            let next_token = logits_v
                .iter()
                .enumerate()
                .max_by(|(_, u), (_, v)| u.total_cmp(v))
                .map(|(i, _)| i as u32)
                .unwrap();
            tokens.push(next_token);

            let prob = softmax(&logits, D::Minus1)
                .map_err(s)?
                .i(next_token as usize)
                .map_err(s)?
                .to_scalar::<f32>()
                .map_err(s)? as f64;
            if next_token == self.eot_token || tokens.len() > self.model.config.max_target_positions {
                break;
            }
            sum_logprob += prob.ln();
        }
        let text = self.tokenizer.decode(&tokens, true).unwrap_or_default();
        let avg_logprob = sum_logprob / tokens.len() as f64;
        Ok((text, no_speech_prob, avg_logprob))
    }
}

/* ── native tests (whisper files downloaded to .tools/ref/whisper/) ─────── */
#[cfg(test)]
mod tests {
    use super::*;

    fn ref_dir() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.tools/ref/whisper")
    }

    #[test]
    fn whisper_transcribes_synthetic_audio() {
        let d = ref_dir();
        let model = std::fs::read(d.join("model.gguf")).expect("model.gguf");
        let tok = std::fs::read(d.join("tokenizer.json")).expect("tokenizer.json");
        let cfg = std::fs::read(d.join("config.json")).expect("config.json");
        let mut w = Whisper::new_inner(&model, &tok, &cfg).expect("whisper loads");
        // 1.5s: silence + a soft 440Hz tone - must not panic; silence-ish output ok
        let mut pcm = vec![0f32; 24000];
        for (i, p) in pcm.iter_mut().enumerate().skip(8000).take(8000) {
            *p = 0.05 * (2.0 * std::f64::consts::PI * 440.0 * i as f64 / 16000.0).sin() as f32;
        }
        let text = w.transcribe_inner(&pcm).expect("transcribe runs");
        println!("transcript: {text:?}");
    }

    /// Two prompts in a row on one Qwen3 model: the second fails unless the KV
    /// cache is cleared when a new prompt starts (see `Arch::forward`).
    #[test]
    #[ignore = "needs .tools/ref/qwen3/{model.gguf,tokenizer.json}; run with --ignored"]
    fn qwen3_answers_two_prompts_in_a_row() {
        let d = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.tools/ref/qwen3");
        let gguf = std::fs::read(d.join("model.gguf")).expect("model.gguf");
        let tok = std::fs::read(d.join("tokenizer.json")).expect("tokenizer.json");
        let mut m = Model::new_inner(&gguf, &tok).expect("qwen3 loads");
        assert!(matches!(m.model, Arch::Qwen3(_)), "GGUF must dispatch to qwen3");
        for q in ["What is 2+2?", "Name one primary colour."] {
            let prompt = format!(
                "<|im_start|>user\n{q}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
            );
            let mut text = m.init_inner(prompt, 0.0, 0.0, 1.0, 32, 1).expect("prefill");
            while !m.is_eos() {
                text.push_str(&m.next_inner().expect("decode"));
            }
            println!("{q} -> {text:?}");
            assert!(!text.trim().is_empty(), "empty answer to {q:?}");
        }
    }
}
