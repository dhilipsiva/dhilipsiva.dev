#!/usr/bin/env bash
# Build Book 1 in isolation, or mount an existing ui/dist/rights-nobody-has-to-earn.
# Requires Python 3.11+, git, uv, Rust and the wasm32-unknown-unknown target.
# RIGHTS_BOOK_REF accepts main (default), a tag, or a full commit ID.
# RIGHTS_BOOK_ARTIFACT_DIR bypasses compilation for a local preview.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RIGHTS_BOOK_REPO="${RIGHTS_BOOK_REPO:-https://github.com/dhilipsiva/rights-nobody-has-to-earn.git}"
RIGHTS_BOOK_REF="${RIGHTS_BOOK_REF:-main}"
EDGE_OUT="$ROOT/.tools/rights-book/edge"

if [[ -n "${RIGHTS_BOOK_ARTIFACT_DIR:-}" ]]; then
    python3 "$ROOT/scripts/rights_book.py" mount "$RIGHTS_BOOK_ARTIFACT_DIR" \
        --revision "${RIGHTS_BOOK_ARTIFACT_REVISION:-local-artifact-unverified}" \
        --edge-output "$EDGE_OUT"
    exit 0
fi

for tool in git cargo rustup uv python3; do
    command -v "$tool" >/dev/null || { echo "error: missing $tool" >&2; exit 1; }
done
rustup target list --installed | grep -qx wasm32-unknown-unknown || {
    echo 'error: run rustup target add wasm32-unknown-unknown first' >&2; exit 1;
}

WORK="$(mktemp -d -t rights-book.XXXXXXXX)"
trap 'rm -rf -- "$WORK"' EXIT

checkout() {
    git init --quiet "$3"
    git -C "$3" remote add origin "$1"
    git -C "$3" fetch --quiet --depth 1 origin -- "$2"
    git -C "$3" checkout --quiet --detach FETCH_HEAD
}

echo "Fetching Book 1: $RIGHTS_BOOK_REPO @ $RIGHTS_BOOK_REF"
checkout "$RIGHTS_BOOK_REPO" "$RIGHTS_BOOK_REF" "$WORK/book"
REVISION="$(git -C "$WORK/book" rev-parse HEAD)"
ENGINE_REPO="$(awk '$1 == "repository" {print $2}' "$WORK/book/engine.pin")"
ENGINE_REV="$(awk '$1 == "revision" {print $2}' "$WORK/book/engine.pin")"
[[ "$ENGINE_REV" =~ ^[0-9a-f]{40}$ && -n "$ENGINE_REPO" ]] || {
    echo 'error: invalid engine.pin' >&2; exit 1;
}
checkout "$ENGINE_REPO" "$ENGINE_REV" "$WORK/nibli"
[[ "$(git -C "$WORK/nibli" rev-parse HEAD)" == "$ENGINE_REV" ]]

BINDGEN_VERSION="$(python3 - "$WORK/book/ui/Cargo.lock" <<'PY'
import sys, tomllib
with open(sys.argv[1], 'rb') as f:
    versions = {p['version'] for p in tomllib.load(f)['package'] if p['name'] == 'wasm-bindgen'}
if len(versions) != 1:
    raise SystemExit('Expected exactly one wasm-bindgen version in ui/Cargo.lock')
print(versions.pop())
PY
)"
PRIVATE_TOOLS="$ROOT/.tools/rights-book/wasm-bindgen-$BINDGEN_VERSION"
export WASM_BINDGEN="$PRIVATE_TOOLS/bin/wasm-bindgen"
if [[ ! -x "$WASM_BINDGEN" ]] || [[ "$("$WASM_BINDGEN" --version)" != "wasm-bindgen $BINDGEN_VERSION" ]]; then
    cargo install wasm-bindgen-cli --version "$BINDGEN_VERSION" --locked --root "$PRIVATE_TOOLS"
fi
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/.tools/uv-cache}"
# Upstream's builder reads ui/target directly; don't inherit another target dir.
unset CARGO_TARGET_DIR
echo "Building Book 1 $REVISION with engine $ENGINE_REV"
(cd "$WORK/book" && python3 ui/scripts/build.py web)
python3 "$ROOT/scripts/rights_book.py" mount "$WORK/book/ui/dist/rights-nobody-has-to-earn" \
    --revision "$REVISION" --edge-output "$EDGE_OUT"
