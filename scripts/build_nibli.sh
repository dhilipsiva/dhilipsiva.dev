#!/usr/bin/env bash
# Build BOTH /nibli artifacts from the upstream nibli crate, fetched at build time:
#   - nibli-wasm → static/nibli/wasm/        (wasm-bindgen wrapper; powers the guided /nibli demo)
#   - nibli-ui   → static/nibli-playground/  (the full Dioxus Transparency Triad app, served at /nibli-playground/)
# One pinned source, two builds. Run locally to refresh development copies.
#
# Requires: git, Node.js, Rust + the wasm32-unknown-unknown target, wasm-pack, and dx (dioxus-cli).
# Override the source with the NIBLI_REPO / NIBLI_REF environment variables.
set -euo pipefail

NIBLI_REPO="${NIBLI_REPO:-https://github.com/dhilipsiva/nibli}"
NIBLI_DX="${NIBLI_DX:-dx}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NIBLI_REF="${NIBLI_REF:-$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).engine_revision' "$ROOT/nibli-engine-lock.json")}"
WASM_DEST="$ROOT/static/nibli/wasm"
UI_DEST="$ROOT/static/nibli-playground"

for tool in git node wasm-pack "$NIBLI_DX"; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    echo "  wasm-pack: https://rustwasm.github.io/wasm-pack/   dx: https://dioxuslabs.com/learn/0.7/getting_started/" >&2
    exit 1
  }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SRC="$WORK/nibli"

echo "→ fetching nibli ($NIBLI_REF) from $NIBLI_REPO"
git init --quiet "$SRC"
git -C "$SRC" remote add origin "$NIBLI_REPO"
git -C "$SRC" fetch --quiet --depth 1 origin "$NIBLI_REF"
git -C "$SRC" checkout --quiet --detach FETCH_HEAD
NIBLI_COMMIT="$(git -C "$SRC" rev-parse HEAD)"

# (No dictionary fetch: since the committed-corpus milestone the lexicon is
# plain Rust source in nibli-lexicon — builds are zero-network by design.)

# ── 1. nibli-wasm → static/nibli/wasm/ ──────────────────────────────────────
echo "→ wasm-pack build nibli-wasm (release, target web)"
wasm-pack build "$SRC/nibli-wasm" --release --target web --out-dir pkg
mkdir -p "$WASM_DEST"
for f in nibli_wasm.js nibli_wasm_bg.wasm nibli_wasm.d.ts; do
  cp "$SRC/nibli-wasm/pkg/$f" "$WASM_DEST/$f"
done

# Check the page's actual presets against the engine this build will publish.
node "$ROOT/tests/nibli.mjs"
node "$ROOT/scripts/test_nibli_admission.mjs"

# ── 2. nibli-ui → static/nibli-playground/ ──────────────────────────────────
# Standalone Dioxus app; --base-path makes its assets resolve under /nibli-playground/.
echo "→ dx build nibli-ui (release, web, base-path nibli-playground)"
( cd "$SRC/nibli-ui" && "$NIBLI_DX" build --release --platform web --base-path nibli-playground )
UI_OUT="$(dirname "$(find "$SRC/target/dx" -name index.html -path '*web*' | head -n1)")"
[ -f "$UI_OUT/index.html" ] || { echo "error: dx web output (index.html) not found under $SRC/target/dx" >&2; exit 1; }
rm -rf "$UI_DEST"
mkdir -p "$UI_DEST"
cp -R "$UI_OUT/." "$UI_DEST/"

node - "$WASM_DEST" "$UI_DEST" "$NIBLI_COMMIT" <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const [wasm, ui, revision] = process.argv.slice(2);
const manifest = {schema: 1, engine_revision: revision,
  wasm_sha256: crypto.createHash('sha256').update(fs.readFileSync(`${wasm}/nibli_wasm_bg.wasm`)).digest('hex')};
for (const folder of [wasm, ui]) fs.writeFileSync(`${folder}/build-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
NODE

echo "✓ nibli wasm + playground updated from ${NIBLI_REPO}@${NIBLI_REF}"
