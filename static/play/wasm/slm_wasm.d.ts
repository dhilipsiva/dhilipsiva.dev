/* tslint:disable */
/* eslint-disable */

export class Model {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Prefill the (ChatML) prompt and sample the first token.
     */
    init_with_prompt(prompt: string, temp: number, top_p: number, repeat_penalty: number, max_tokens: number, seed: bigint): string;
    is_eos(): boolean;
    constructor(gguf: Uint8Array, tokenizer_json: Uint8Array);
    /**
     * One decode step. Empty string when finished (check `is_eos`).
     */
    next_token(): string;
}

export class Whisper {
    free(): void;
    [Symbol.dispose](): void;
    constructor(model_gguf: Uint8Array, tokenizer_json: Uint8Array, config_json: Uint8Array);
    /**
     * Transcribe 16kHz mono f32 PCM. Returns the joined transcript.
     */
    transcribe(pcm: Float32Array): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_model_free: (a: number, b: number) => void;
    readonly __wbg_whisper_free: (a: number, b: number) => void;
    readonly model_init_with_prompt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: bigint) => [number, number, number, number];
    readonly model_is_eos: (a: number) => number;
    readonly model_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly model_next_token: (a: number) => [number, number, number, number];
    readonly whisper_new: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly whisper_transcribe: (a: number, b: number, c: number) => [number, number, number, number];
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
