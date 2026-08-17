#!/usr/bin/env bash
set -euo pipefail

# ADK API server for the Google Workspace agents, in ../google-workspace-agents.
# Backs the Slack gateway (scripts/gws-slack-gateway.sh) and any other HTTP
# client. Long-running — started once, left running.
#
# Always invoked via `uv run` so it resolves to that project's own .venv
# deps rather than a stray global/Homebrew adk (see its CLAUDE.md).

PORT=8917

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GWS_DIR="$(cd "$SCRIPT_DIR/../../google-workspace-agents" && pwd)"

# Guard against a stale instance still holding the port (e.g. left running
# from a previous day's orchestrator run) — starting a second one would just
# fail to bind, so skip cleanly instead of erroring.
EXISTING_PID=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo "port $PORT already in use (pid $EXISTING_PID) — assuming api_server is already running, not starting a second one."
    exit 0
fi

cd "$GWS_DIR"
unset VIRTUAL_ENV
# Redirected (non-tty) stdout is fully buffered by default — force it
# unbuffered so anything this process prints reaches the log file promptly.
export PYTHONUNBUFFERED=1
exec uv run adk api_server workspace_agents --use_local_storage --port "$PORT"
