#!/bin/bash
set -e

PLIST_NAME="com.user.caffeinate"
PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/launchd/${PLIST_NAME}.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "==> Setting wake schedule: 7:00 AM every day"
sudo pmset repeat wake MTWRFSU 07:00:00

echo "==> Installing caffeinate launch agent"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DEST"

if launchctl list | grep -q "$PLIST_NAME"; then
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi
launchctl load "$PLIST_DEST"

echo ""
echo "Done. MacBook will now:"
echo "  - Wake at 7:00 AM every day (via pmset)"
echo "  - Stay awake while logged in (via caffeinate -i)"
echo ""
echo "Run uninstall.sh to undo these changes."
