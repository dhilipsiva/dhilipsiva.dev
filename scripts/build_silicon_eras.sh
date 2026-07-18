#!/usr/bin/env bash
# Build the silicon·eras explorable from the upstream silicon-eras crate, fetched
# at build time: app/ (a Dioxus 0.7 web app; workspace package `silicon-eras`,
# dataset embedded at build time by app/build.rs) → static/silicon-eras/, served
# at /silicon-eras/. CI runs this on every deploy so the live app always tracks
# the latest dataset/engine; run it locally to refresh your dev copy.
#
# Requires: git, Rust + the wasm32-unknown-unknown target, and dx (dioxus-cli).
# Override the source with the SILICON_ERAS_REPO / SILICON_ERAS_REF env variables.
set -euo pipefail

SILICON_ERAS_REPO="${SILICON_ERAS_REPO:-https://github.com/dhilipsiva/silicon-eras}"
SILICON_ERAS_REF="${SILICON_ERAS_REF:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/static/silicon-eras"

for tool in git dx; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    echo "  dx: https://dioxuslabs.com/learn/0.7/getting_started/" >&2
    exit 1
  }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SRC="$WORK/silicon-eras"

echo "→ fetching silicon-eras ($SILICON_ERAS_REF) from $SILICON_ERAS_REPO"
git clone --quiet --depth 1 --branch "$SILICON_ERAS_REF" "$SILICON_ERAS_REPO" "$SRC"

# app/ (workspace member `silicon-eras`) → static/silicon-eras/
# --base-path silicon-eras makes its assets resolve under /silicon-eras/, so it
# MUST match the dest dir name. dx writes to the workspace-root target (app is a
# member), so we look there — same as voksa/nibli.
echo "→ dx build silicon-eras (release, web, base-path silicon-eras)"
( cd "$SRC/app" && dx build --release --platform web --base-path silicon-eras )
OUT="$(dirname "$(find "$SRC/target/dx" -name index.html -path '*web*' | head -n1)")"
[ -f "$OUT/index.html" ] || { echo "error: dx web output (index.html) not found under $SRC/target/dx" >&2; exit 1; }
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$OUT/." "$DEST/"

echo "✓ silicon-eras updated from ${SILICON_ERAS_REPO}@${SILICON_ERAS_REF}"
