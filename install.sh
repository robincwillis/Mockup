#!/bin/bash
# install.sh — Installs Deacon: pmset wake schedule, caffeinate + orchestrator
# LaunchAgents, and the wake-scheduler + post-wake LaunchDaemons.
# Run with: ./install.sh   (sudo prompts inline for pmset + LaunchDaemons)

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_DIR="$HOME/Library/LaunchAgents"
DAEMONS_DIR="/Library/LaunchDaemons"
INSTALL_DIR="/usr/local/bin/macbook-wake"

[[ "$(uname)" != "Darwin" ]] && { echo "This script is for macOS only." >&2; exit 1; }

# ---- wake-scheduler scripts (installed to /usr/local/bin/macbook-wake) ------
# The LaunchDaemon plists reference these absolute paths, so the scripts must
# live outside the repo for the daemons to find them after reboots.
echo "==> Installing wake-automation scripts to $INSTALL_DIR"
sudo mkdir -p "$INSTALL_DIR"
sudo cp "$REPO_DIR/scripts/schedule-wake.sh" "$INSTALL_DIR/schedule-wake.sh"
sudo cp "$REPO_DIR/scripts/post-wake.sh"     "$INSTALL_DIR/post-wake.sh"
sudo chmod +x "$INSTALL_DIR/schedule-wake.sh" "$INSTALL_DIR/post-wake.sh"

# ---- wake-scheduler + post-wake LaunchDaemons --------------------------------
echo "==> Installing wake-automation LaunchDaemons"
for plist in com.local.wake-scheduler com.local.post-wake; do
    DEST="$DAEMONS_DIR/$plist.plist"
    sudo launchctl unload "$DEST" 2>/dev/null || true
    sudo cp "$REPO_DIR/launchd/$plist.plist" "$DEST"
    sudo chown root:wheel "$DEST"
    sudo chmod 644 "$DEST"
    sudo launchctl load -w "$DEST"
    echo "    loaded $plist"
done

# ---- initial pmset wake schedule (the LaunchDaemon will also re-apply it) ---
echo "==> Setting initial pmset wake schedule"
sudo "$INSTALL_DIR/schedule-wake.sh"

# ---- caffeinate agent -------------------------------------------------------
echo "==> Installing caffeinate launch agent"
mkdir -p "$AGENTS_DIR"
cp "$REPO_DIR/launchd/com.user.caffeinate.plist" "$AGENTS_DIR/com.user.caffeinate.plist"
launchctl unload "$AGENTS_DIR/com.user.caffeinate.plist" 2>/dev/null || true
launchctl load "$AGENTS_DIR/com.user.caffeinate.plist"

# ---- python dependencies ----------------------------------------------------
echo "==> Installing Python dependencies"
pip install -q -r "$REPO_DIR/requirements.txt"

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

# ---- dashboard agent (persistent, binds 0.0.0.0 — reachable from your phone) -
echo "==> Installing dashboard launch agent"
sed "s|REPO_DIR|$REPO_DIR|g" \
    "$REPO_DIR/launchd/com.user.dashboard.plist" \
    > "$AGENTS_DIR/com.user.dashboard.plist"

launchctl unload "$AGENTS_DIR/com.user.dashboard.plist" 2>/dev/null || true
launchctl load "$AGENTS_DIR/com.user.dashboard.plist"

# ---- config -----------------------------------------------------------------
if [ ! -f "$REPO_DIR/config.yaml" ]; then
    cp "$REPO_DIR/config.example.yaml" "$REPO_DIR/config.yaml"
    echo ""
    echo "  Created config.yaml from example — edit it to define your processes."
fi

echo ""
echo "Done. MacBook will now:"
echo "  - Wake daily via pmset                     (re-applied at boot + 4:55 AM)"
echo "  - Run post-wake.sh at 6:00 AM              (SSH check, IP log)"
echo "  - Stay awake while logged in               (caffeinate -i)"
echo "  - Run 'orchestrate.py start' after wake    (launchd)"
echo "  - Serve the dashboard continuously on 0.0.0.0:8765 (launchd)"
echo ""
echo "The dashboard is reachable from other devices on your network (e.g. your"
echo "phone) at http://<this-mac's-ip>:8765 — it can also start/stop/enable"
echo "processes with no authentication, so only use this on a trusted network."
echo ""
echo "Verify:"
echo "  pmset -g sched"
echo "  tail -f /var/log/macbook-wake.log"
echo "  tail -f /var/log/macbook-post-wake.log"
echo ""
echo "Manage processes manually:"
echo "  ./orchestrate.py start   [name]"
echo "  ./orchestrate.py stop    [name]"
echo "  ./orchestrate.py status"
echo "  ./orchestrate.py logs    [name]"
echo ""
echo "Make sure SSH / Remote Login is enabled in:"
echo "  System Settings → General → Sharing → Remote Login"
echo ""
echo "Run uninstall.sh to undo all of the above."
