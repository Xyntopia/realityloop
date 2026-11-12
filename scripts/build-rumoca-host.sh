#!/usr/bin/env sh
set -eu

# Optional developer-only Rumoca external-C test runtime. The main published
# dependency remains pinned; no large compiled WASM binary is committed here.
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RUMOCA_SOURCE_DIR="${RUMOCA_SOURCE_DIR:-$ROOT/../frontend/packages/rumoca}"
OUT_DIR="$ROOT/build/rumoca-host"
if [ ! -f "$RUMOCA_SOURCE_DIR/crates/rumoca-bind-wasm/Cargo.toml" ]; then
  printf '%s\n' "Rumoca source checkout required: $RUMOCA_SOURCE_DIR" >&2
  exit 2
fi
cd "$RUMOCA_SOURCE_DIR"
cargo build -p rumoca-bind-wasm --target wasm32-unknown-unknown --features sim-rk45
TARGET_DIR="${CARGO_TARGET_DIR:-$RUMOCA_SOURCE_DIR/target}"
mkdir -p "$OUT_DIR"
"${WASM_BINDGEN_CLI:-wasm-bindgen}" "$TARGET_DIR/wasm32-unknown-unknown/debug/rumoca_bind_wasm.wasm" \
  --target web --out-dir "$OUT_DIR"
printf '%s\n' "Developer host runtime built at $OUT_DIR"
