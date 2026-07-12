#!/usr/bin/env bash
# Build BOTH /nibli artifacts from the upstream nibli crate, fetched at build time:
#   - nibli-wasm → static/nibli/wasm/        (wasm-bindgen wrapper; powers the guided /nibli demo)
#   - nibli-ui   → static/nibli-playground/  (the full Dioxus Transparency Triad app, served at /nibli-playground/)
# One clone, two builds. CI runs this on every deploy so both always track the latest
# engine; run it locally to refresh your dev copies.
#
# Requires: git, Rust + the wasm32-unknown-unknown target, wasm-pack, and dx (dioxus-cli).
# Override the source with the NIBLI_REPO / NIBLI_REF environment variables.
set -euo pipefail

NIBLI_REPO="${NIBLI_REPO:-https://github.com/dhilipsiva/nibli}"
NIBLI_REF="${NIBLI_REF:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM_DEST="$ROOT/static/nibli/wasm"
UI_DEST="$ROOT/static/nibli-playground"

for tool in git wasm-pack dx; do
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
git clone --quiet --depth 1 --branch "$NIBLI_REF" "$NIBLI_REPO" "$SRC"

# ── 0. dictionary-en.json → full alias-map build ────────────────────────────
# The lensisku dictionary is a COMPILE-TIME input (gitignored upstream): with it
# the bundle ships the full ~1,341-alias Klaro map; without it the build falls
# back to the ~100 curated aliases and the deployed playground's Klaro examples
# + Formalize lose the long-tail vocabulary (nibli DEPLOY.md "Ship the
# frontend"). Warn-and-continue on fetch failure — the fallback still builds.
echo "→ fetching lensisku dictionary (full Klaro alias map)"
curl -fsSL --retry 2 "https://lensisku.lojban.org/api/export/cached/en/json" \
  -o "$SRC/dictionary-en.json" \
  || echo "warning: dictionary fetch failed — building with the curated fallback tables" >&2

# ── 1. nibli-wasm → static/nibli/wasm/ ──────────────────────────────────────
echo "→ wasm-pack build nibli-wasm (release, target web)"
wasm-pack build "$SRC/nibli-wasm" --release --target web --out-dir pkg
mkdir -p "$WASM_DEST"
for f in nibli_wasm.js nibli_wasm_bg.wasm nibli_wasm.d.ts; do
  cp "$SRC/nibli-wasm/pkg/$f" "$WASM_DEST/$f"
done

# ── 2. nibli-ui → static/nibli-playground/ ──────────────────────────────────
# Standalone Dioxus app; --base-path makes its assets resolve under /nibli-playground/.
echo "→ dx build nibli-ui (release, web, base-path nibli-playground)"
( cd "$SRC/nibli-ui" && dx build --release --platform web --base-path nibli-playground )
UI_OUT="$(dirname "$(find "$SRC/target/dx" -name index.html -path '*web*' | head -n1)")"
[ -f "$UI_OUT/index.html" ] || { echo "error: dx web output (index.html) not found under $SRC/target/dx" >&2; exit 1; }
rm -rf "$UI_DEST"
mkdir -p "$UI_DEST"
cp -R "$UI_OUT/." "$UI_DEST/"

echo "✓ nibli wasm + playground updated from ${NIBLI_REPO}@${NIBLI_REF}"
