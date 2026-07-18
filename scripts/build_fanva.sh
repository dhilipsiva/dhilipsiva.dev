#!/usr/bin/env bash
# Build the fanva translator playground from the upstream fanva crate, fetched at
# build time: fanva-ui (a Dioxus 0.7 app — the agentic English→Lojban translator;
# the gerna/smuni/camxes gates run in-browser, zero network for the core) →
# static/fanva/, served at /fanva/. CI runs this on every deploy so the live
# playground always tracks the latest engine; run it locally to refresh your copy.
#
# Requires: git, curl, Rust + the wasm32-unknown-unknown target, and dx (dioxus-cli).
# Override the source with the FANVA_REPO / FANVA_REF environment variables.
set -euo pipefail

FANVA_REPO="${FANVA_REPO:-https://github.com/dhilipsiva/fanva}"
FANVA_REF="${FANVA_REF:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/static/fanva"

for tool in git dx; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    echo "  dx: https://dioxuslabs.com/learn/0.7/getting_started/" >&2
    exit 1
  }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SRC="$WORK/fanva"

echo "→ fetching fanva ($FANVA_REF) from $FANVA_REPO"
git clone --quiet --depth 1 --branch "$FANVA_REF" "$FANVA_REPO" "$SRC"

# dictionary-en.json → full smuni-dictionary build. COMPILE-TIME input read by
# smuni-dictionary/build.rs at ../dictionary-en.json (i.e. the workspace root): with
# it the bundle ships the full lensisku vocabulary; without it the build falls back
# to the ~175 curated entries (fanva DEPLOY.md "Ship the frontend"). Warn-and-continue
# on fetch failure — the fallback still builds.
echo "→ fetching lensisku dictionary (full smuni-dictionary vocabulary)"
curl -fsSL --retry 2 "https://lensisku.lojban.org/api/export/cached/en/json" \
  -o "$SRC/dictionary-en.json" \
  || echo "warning: dictionary fetch failed — building with the curated fallback tables" >&2

# fanva-ui → static/fanva/
# fanva commits no Dioxus.toml/base_path (keeps `dx serve` root-relative); the
# /fanva/ base path is applied here at build time and MUST equal the dest dir name.
echo "→ dx build fanva-ui (release, web, base-path fanva)"
( cd "$SRC/fanva-ui" && dx build --release --platform web --base-path fanva )
OUT="$(dirname "$(find "$SRC/target/dx" -name index.html -path '*web*' | head -n1)")"
[ -f "$OUT/index.html" ] || { echo "error: dx web output (index.html) not found under $SRC/target/dx" >&2; exit 1; }
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$OUT/." "$DEST/"

echo "✓ fanva playground updated from ${FANVA_REPO}@${FANVA_REF}"
