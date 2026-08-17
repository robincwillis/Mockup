#!/usr/bin/env bash
set -euo pipefail

# Shared runner for the Google Workspace agents, in ../google-workspace-agents.
# Single-step (non-interactive) adk query — runs once and exits, per
# orchestrate.py's `script` process contract. Every one-shot gws-* process
# (Drive Architect, Inbox Gardener, Storage Sentinel, Auction Intelligence,
# ...) uses this same script; what each one actually does is entirely
# defined by its own `prompt:` in config.yaml, passed through here as $1.
#
# Always invoked via `uv run` so it resolves to that project's own .venv
# deps rather than a stray global/Homebrew adk (see its CLAUDE.md).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GWS_DIR="$(cd "$SCRIPT_DIR/../../google-workspace-agents" && pwd)"

cd "$GWS_DIR"
# Unset VIRTUAL_ENV so uv discovers this project's own .venv (in $GWS_DIR)
# instead of honoring a venv activated by the caller (e.g. macbook-rise's own).
unset VIRTUAL_ENV
exec uv run adk run workspace_agents --use_local_storage "$1"
