#!/usr/bin/env bash
set -euo pipefail

# Syncs bookmarks live from Chrome + Safari + any export files in
# bookmarks/, in ../bookhound. Safe to re-run any time — every bookmark's
# vector ID is sha256(url), so already-indexed URLs are skipped automatically.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOKHOUND_DIR="$(cd "$SCRIPT_DIR/../../bookhound" && pwd)"

cd "$BOOKHOUND_DIR"
# Redirected (non-tty) stdout is fully buffered by default — force it
# unbuffered so sync progress reaches the log file promptly.
export PYTHONUNBUFFERED=1
exec "$BOOKHOUND_DIR/.venv/bin/python" scripts/sync.py
