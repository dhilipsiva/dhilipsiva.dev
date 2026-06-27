#!/usr/bin/env bash
# Build the /nibli Transparency Triad wasm from the upstream nibli crate.
#
# Fetches github.com/dhilipsiva/nibli at build time and compiles its `nibli-wasm`
# binding crate (gerna/smuni/logji + smuni-dictionary behind wasm-bindgen),
# dropping the three artifacts into static/nibli/wasm/. CI runs this on every
# deploy so the live demo always tracks the latest engine; run it locally to
# refresh your dev copy.
#
# Requires: git, Rust + the wasm32-unknown-unknown target, and wasm-pack.
# Override the source with the NIBLI_REPO / NIBLI_REF environment variables.
set -euo pipefail

NIBLI_REPO="${NIBLI_REPO:-https://github.com/dhilipsiva/nibli}"
NIBLI_REF="${NIBLI_REF:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/static/nibli/wasm"

command -v wasm-pack >/dev/null 2>&1 || {
  echo "error: wasm-pack not found on PATH — see https://rustwasm.github.io/wasm-pack/" >&2
  exit 1
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "→ fetching nibli ($NIBLI_REF) from $NIBLI_REPO"
git clone --quiet --depth 1 --branch "$NIBLI_REF" "$NIBLI_REPO" "$WORK/nibli"

echo "→ wasm-pack build nibli-wasm (release, target web)"
wasm-pack build "$WORK/nibli/nibli-wasm" --release --target web --out-dir pkg

echo "→ installing artifacts into static/nibli/wasm/"
mkdir -p "$DEST"
for f in nibli_wasm.js nibli_wasm_bg.wasm nibli_wasm.d.ts; do
  cp "$WORK/nibli/nibli-wasm/pkg/$f" "$DEST/$f"
done

echo "✓ nibli wasm updated from ${NIBLI_REPO}@${NIBLI_REF}"
