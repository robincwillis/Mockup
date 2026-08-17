#!/usr/bin/env bash
set -euo pipefail

# Smoke test for orchestrate.py's `script` process type — no external
# dependencies, safe to enable and run at any time. Sleeps before exiting so
# the dashboard has a genuinely long-running process to show alongside
# hello-command's near-instant one.

sleep 5
echo "goodbye"
