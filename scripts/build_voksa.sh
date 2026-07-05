#!/usr/bin/env bash
# Build the voksa tuning console from the upstream voksa crate, fetched at build
# time: crates/voksa-console-demo (a Dioxus 0.7 app that mounts the
# voksa-console TuningConsole component) → static/voksa/, served at /voksa/.
# CI runs this on every deploy so the live console always tracks the latest
# engine; run it locally to refresh your dev copy.
#
# Requires: git, Rust + the wasm32-unknown-unknown target, and dx (dioxus-cli).
# Override the source with the VOKSA_REPO / VOKSA_REF environment variables.
set -euo pipefail

VOKSA_REPO="${VOKSA_REPO:-https://github.com/dhilipsiva/voksa}"
VOKSA_REF="${VOKSA_REF:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/static/voksa"

for tool in git dx; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    echo "  dx: https://dioxuslabs.com/learn/0.7/getting_started/" >&2
    exit 1
  }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SRC="$WORK/voksa"

echo "→ fetching voksa ($VOKSA_REF) from $VOKSA_REPO"
git clone --quiet --depth 1 --branch "$VOKSA_REF" "$VOKSA_REPO" "$SRC"

# voksa-console-demo → static/voksa/
# --base-path voksa makes its assets resolve under /voksa/.
echo "→ dx build voksa-console-demo (release, web, base-path voksa)"
( cd "$SRC/crates/voksa-console-demo" && dx build --release --platform web --base-path voksa )
OUT="$(dirname "$(find "$SRC/target/dx" -name index.html -path '*web*' | head -n1)")"
[ -f "$OUT/index.html" ] || { echo "error: dx web output (index.html) not found under $SRC/target/dx" >&2; exit 1; }
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$OUT/." "$DEST/"

echo "✓ voksa console updated from ${VOKSA_REPO}@${VOKSA_REF}"
