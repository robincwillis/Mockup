#!/bin/bash
# uninstall.sh — Removes Deacon (orchestration + wake automation).
# Run with: ./uninstall.sh   (sudo prompts inline for LaunchDaemons + pmset)

set -e

AGENTS_DIR="$HOME/Library/LaunchAgents"
DAEMONS_DIR="/Library/LaunchDaemons"
INSTALL_DIR="/usr/local/bin/macbook-wake"

echo "==> Removing wake schedule"
sudo pmset repeat cancel

echo "==> Unloading orchestrator launch agent"
launchctl unload "$AGENTS_DIR/com.user.orchestrator.plist" 2>/dev/null || true
rm -f "$AGENTS_DIR/com.user.orchestrator.plist"

echo "==> Unloading wake-automation launch daemons"
for plist in com.local.wake-scheduler com.local.post-wake; do
    DEST="$DAEMONS_DIR/$plist.plist"
    if [ -f "$DEST" ]; then
        sudo launchctl unload -w "$DEST" 2>/dev/null || true
        sudo rm -f "$DEST"
        echo "    removed $DEST"
    fi
done

if [ -d "$INSTALL_DIR" ]; then
    echo "==> Removing installed wake scripts at $INSTALL_DIR"
    sudo rm -rf "$INSTALL_DIR"
fi

echo ""
echo "Done. MacBook will now sleep normally and no processes will auto-start."
echo "Logs and pids directories are left intact — remove them manually if needed."
