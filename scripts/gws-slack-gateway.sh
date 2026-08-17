#!/usr/bin/env bash
set -euo pipefail

# Slack Socket Mode gateway for the Google Workspace agents, in
# ../google-workspace-agents. Bridges Slack DMs/@mentions to the ADK
# api_server (scripts/gws-api-server.sh) — no port of its own, connects
# out to Slack over a websocket. Long-running — started once, left running.
#
# Always invoked via `uv run` so it resolves to that project's own .venv
# deps rather than a stray global/Homebrew adk (see its CLAUDE.md).

PORT=8917

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GWS_DIR="$(cd "$SCRIPT_DIR/../../google-workspace-agents" && pwd)"

# orchestrate.py starts all enabled processes in parallel, so gws-api-server
# might not be listening yet — wait up to 30s for it before connecting.
echo "waiting for api_server on port $PORT..."
for i in $(seq 1 30); do
    lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 1
done

cd "$GWS_DIR"
unset VIRTUAL_ENV
export ADK_BASE_URL="http://127.0.0.1:$PORT"
# Redirected (non-tty) stdout is fully buffered by default, so slack_gateway.py's
# own print()s would sit in memory instead of reaching the log file — the
# dashboard's log preview would look frozen even while it's actively working.
export PYTHONUNBUFFERED=1
exec uv run python slack_gateway.py
