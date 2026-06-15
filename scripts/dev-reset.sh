#!/usr/bin/env bash
# Clear accumulated development cruft for whisper-tauri (macOS only).
#
# Targets only state the app UI CANNOT remove: retired Whisper models,
# orphaned recordings, and OS/WebView caches. State the UI already manages
# (current models, binaries, history, settings) is intentionally out of
# scope — delete those in-app.
#
# With no flags, clears all three default targets. Flags narrow the run.
# Targets are listed and confirmed before deletion unless --yes is given.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: dev-reset.sh supports macOS only (Win/Linux paths not yet added)." >&2
  exit 1
fi

# Guard against HOME="" — paths below would resolve to /Library/... and
# this script runs rm -rf on them.
: "${HOME:?HOME must be set and non-empty}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="${SCRIPT_DIR}/../src-tauri"

# Read the bundle identifier from tauri.conf.json so the script cannot
# drift from the app configuration. Covers all failure modes (missing
# node, missing/malformed file, missing key) with one friendly message.
if ! APP_ID="$(node -p 'require(process.argv[1]).identifier' "${TAURI_DIR}/tauri.conf.json" 2>/dev/null)" \
  || [[ -z "$APP_ID" || "$APP_ID" == "undefined" ]]; then
  echo "Error: could not read identifier from ${TAURI_DIR}/tauri.conf.json (need node + a valid config)." >&2
  exit 1
fi

DATA_DIR="${HOME}/Library/Application Support/${APP_ID}"
CACHE_DIR="${HOME}/Library/Caches/${APP_ID}"
WEBKIT_DIR="${HOME}/Library/WebKit/${APP_ID}"

# Retired Whisper model files the app UI cannot delete (whisper has no
# legacy-cleanup mechanism, unlike text_processing). Append here when a
# Whisper model is retired — see docs/dev/binary-updates.md.
STALE_WHISPER_MODELS=(
  "ggml-medium.bin"
  "ggml-large-v3.bin"
)

usage() {
  cat <<EOF
Usage: scripts/dev-reset.sh [options]

Clear accumulated development cruft for whisper-tauri (macOS).
Only targets state the app UI cannot remove. With no flags, clears all
three default targets:
  --stale-models  Retired Whisper models in models/ (ggml-medium.bin, ggml-large-v3.bin)
  --recordings    Orphaned recordings in recordings/
  --cache         OS + WebView caches (Caches/, WebKit/)

Opt-in (not part of the default run):
  --build         Run 'cargo clean' in src-tauri (full rebuild costs minutes)

Out of scope (delete these in the app UI): current models, binaries,
history, settings.

Other options:
  --yes, -y    Skip the confirmation prompt
  --help, -h   Show this help
EOF
}

assume_yes=0
run_cargo_clean=0
selective=0
targets=()

# Append only paths that actually exist; unmatched globs arrive as
# literal strings and are filtered out by the -e test.
add_existing() {
  local path
  for path in "$@"; do
    if [[ -e "$path" ]]; then
      targets+=("$path")
    fi
  done
}

add_stale_models() {
  # Guard the empty list: on bash 3.2 `"${arr[@]}"` with set -u errors out.
  [[ "${#STALE_WHISPER_MODELS[@]}" -eq 0 ]] && return
  local name
  for name in "${STALE_WHISPER_MODELS[@]}"; do
    add_existing "${DATA_DIR}/models/${name}"
  done
}

add_recordings() {
  add_existing "${DATA_DIR}/recordings"
}

add_cache() {
  add_existing "${CACHE_DIR}" "${WEBKIT_DIR}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stale-models) selective=1; add_stale_models ;;
    --recordings)   selective=1; add_recordings ;;
    --cache)        selective=1; add_cache ;;
    --build)        selective=1; run_cargo_clean=1 ;;
    --yes | -y)     assume_yes=1 ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Run with --help for usage." >&2
      exit 1
      ;;
  esac
  shift
done

# Refuse to run while the app is up: per-command IPC handlers recreate
# state on first access, and recordings/ may still be in use.
# Best-effort guard — if pgrep itself fails, proceed.
if pgrep -x "whisper-tauri" > /dev/null 2>&1 || pgrep -x "Whisper Tauri" > /dev/null 2>&1; then
  echo "Error: Whisper Tauri appears to be running." >&2
  echo "Quit the app (or stop 'pnpm tauri dev') and retry." >&2
  exit 1
fi

# No flags → clear all three default targets.
if [[ "$selective" -eq 0 ]]; then
  add_stale_models
  add_recordings
  add_cache
fi

if [[ "${#targets[@]}" -eq 0 && "$run_cargo_clean" -eq 0 ]]; then
  echo "Nothing to do: no matching files or directories found."
  exit 0
fi

echo "The following will be removed:"
if [[ "${#targets[@]}" -gt 0 ]]; then
  for target in "${targets[@]}"; do
    echo "  ${target}"
  done
fi
if [[ "$run_cargo_clean" -eq 1 ]]; then
  echo "  (cargo clean in src-tauri)"
fi

if [[ "$assume_yes" -eq 0 ]]; then
  printf 'Proceed? [y/N] '
  read -r answer || {
    echo ""
    echo "Aborted."
    exit 1
  }
  case "$answer" in
    [Yy] | [Yy][Ee][Ss]) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

if [[ "${#targets[@]}" -gt 0 ]]; then
  for target in "${targets[@]}"; do
    rm -rf "$target"
    echo "Removed: ${target}"
  done
fi

if [[ "$run_cargo_clean" -eq 1 ]]; then
  echo "Running cargo clean..."
  (cd "$TAURI_DIR" && cargo clean)
fi

echo "Done."
