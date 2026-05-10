#!/bin/bash
set -e

AGENTS_DIR="$HOME/Library/LaunchAgents"

echo "==> Removing wake schedule"
sudo pmset repeat cancel

echo "==> Unloading caffeinate launch agent"
launchctl unload "$AGENTS_DIR/com.user.caffeinate.plist" 2>/dev/null || true
rm -f "$AGENTS_DIR/com.user.caffeinate.plist"

echo "==> Unloading orchestrator launch agent"
launchctl unload "$AGENTS_DIR/com.user.orchestrator.plist" 2>/dev/null || true
rm -f "$AGENTS_DIR/com.user.orchestrator.plist"

echo ""
echo "Done. MacBook will now sleep normally and no processes will auto-start."
echo "Logs and pids directories are left intact — remove them manually if needed."
