#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_DIR="$HOME/Library/LaunchAgents"

echo "==> Setting wake schedule: 7:00 AM every day"
sudo pmset repeat wake MTWRFSU 07:00:00

# ---- caffeinate agent -------------------------------------------------------
echo "==> Installing caffeinate launch agent"
mkdir -p "$AGENTS_DIR"
cp "$REPO_DIR/launchd/com.user.caffeinate.plist" "$AGENTS_DIR/com.user.caffeinate.plist"
launchctl unload "$AGENTS_DIR/com.user.caffeinate.plist" 2>/dev/null || true
launchctl load "$AGENTS_DIR/com.user.caffeinate.plist"

# ---- python dependencies ----------------------------------------------------
echo "==> Installing Python dependencies"
pip3 install -q -r "$REPO_DIR/requirements.txt"

# ---- orchestrator agent -----------------------------------------------------
echo "==> Installing orchestrator launch agent"
mkdir -p "$REPO_DIR/logs" "$REPO_DIR/pids"
chmod +x "$REPO_DIR/orchestrate.py"

# Stamp the real repo path into the plist before installing
sed "s|REPO_DIR|$REPO_DIR|g" \
    "$REPO_DIR/launchd/com.user.orchestrator.plist" \
    > "$AGENTS_DIR/com.user.orchestrator.plist"

launchctl unload "$AGENTS_DIR/com.user.orchestrator.plist" 2>/dev/null || true
launchctl load "$AGENTS_DIR/com.user.orchestrator.plist"

# ---- config -----------------------------------------------------------------
if [ ! -f "$REPO_DIR/config.yaml" ]; then
    cp "$REPO_DIR/config.example.yaml" "$REPO_DIR/config.yaml"
    echo ""
    echo "  Created config.yaml from example — edit it to define your processes."
fi

echo ""
echo "Done. MacBook will now:"
echo "  - Wake at 7:00 AM every day             (pmset)"
echo "  - Stay awake while logged in            (caffeinate -i)"
echo "  - Run 'orchestrate.py start' at 7:05 AM (launchd)"
echo ""
echo "Manage processes manually:"
echo "  ./orchestrate.py start   [name]"
echo "  ./orchestrate.py stop    [name]"
echo "  ./orchestrate.py status"
echo "  ./orchestrate.py logs    [name]"
echo ""
echo "Run uninstall.sh to undo all of the above."
