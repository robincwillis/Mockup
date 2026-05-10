#!/bin/bash
set -e

PLIST_NAME="com.user.caffeinate"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "==> Removing wake schedule"
sudo pmset repeat cancel

echo "==> Unloading caffeinate launch agent"
if launchctl list | grep -q "$PLIST_NAME"; then
    launchctl unload "$PLIST_DEST"
fi
rm -f "$PLIST_DEST"

echo ""
echo "Done. MacBook will now sleep normally."
