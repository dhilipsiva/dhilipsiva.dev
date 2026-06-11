/* tslint:disable */
/* eslint-disable */

/**
 * One in-memory knowledge base. The page creates one per loaded example;
 * "Reset" just builds a fresh Session and re-asserts the .lojban lines.
 */
export class Session {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Parse one Lojban assertion, compile to FOL, assert. Returns the fact id.
     */
    assert_text(text: string): bigint;
    /**
     * All active facts as JSON: `[{ id, label }]`.
     */
    list_facts(): string;
    constructor();
    /**
     * Run a Lojban query. Returns JSON:
     * `{ status, detail, naf_dependent, proof_text, proof }`.
     */
    query_with_proof(text: string): string;
    /**
     * Clear all facts and rules.
     */
    reset(): void;
    /**
     * Retract a fact by id and rebuild derived state.
     */
    retract_fact(id: bigint): void;
}

/**
 * Word-by-word robotic back-translation (smuni-dictionary, 10k+ jbovlaste
 * entries). Mechanical by design — it is the verification surface, not prose.
 */
export function back_translate(lojban: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_session_free: (a: number, b: number) => void;
    readonly back_translate: (a: number, b: number, c: number) => void;
    readonly session_assert_text: (a: number, b: number, c: number, d: number) => void;
    readonly session_list_facts: (a: number, b: number) => void;
    readonly session_new: () => number;
    readonly session_query_with_proof: (a: number, b: number, c: number, d: number) => void;
    readonly session_reset: (a: number) => void;
    readonly session_retract_fact: (a: number, b: number, c: bigint) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
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
