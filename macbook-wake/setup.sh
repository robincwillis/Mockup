#!/bin/bash
# setup.sh — One-time installer for the MacBook wake automation.
# Run with: sudo bash setup.sh
# Requires macOS, sudo privileges.

set -e

INSTALL_DIR="/usr/local/bin/macbook-wake"
PLIST_DIR="/Library/LaunchDaemons"
SCRIPT_DIR="$(cd "$(dirname "$0")/scripts" && pwd)"
LAUNCHD_DIR="$(cd "$(dirname "$0")/launchd" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()    { echo -e "${GREEN}[setup]${NC} $*"; }
warn()    { echo -e "${YELLOW}[setup]${NC} $*"; }
error()   { echo -e "${RED}[setup]${NC} $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && error "Please run as root: sudo bash setup.sh"
[[ "$(uname)" != "Darwin" ]] && error "This script is for macOS only."

info "Installing MacBook 5am wake automation..."

# ── 1. Copy scripts
info "Installing scripts to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/schedule-wake.sh" "$INSTALL_DIR/schedule-wake.sh"
cp "$SCRIPT_DIR/post-wake.sh"     "$INSTALL_DIR/post-wake.sh"
chmod +x "$INSTALL_DIR/schedule-wake.sh"
chmod +x "$INSTALL_DIR/post-wake.sh"

# ── 2. Install LaunchDaemons
for plist in com.local.wake-scheduler com.local.post-wake; do
    DEST="$PLIST_DIR/$plist.plist"
    info "Installing $DEST..."

    # Unload if already loaded (ignore errors)
    launchctl unload "$DEST" 2>/dev/null || true

    cp "$LAUNCHD_DIR/$plist.plist" "$DEST"
    chown root:wheel "$DEST"
    chmod 644 "$DEST"

    launchctl load -w "$DEST"
    info "Loaded: $plist"
done

# ── 3. Set the initial pmset wake schedule right now
info "Setting pmset wake schedule..."
"$INSTALL_DIR/schedule-wake.sh"

info ""
info "Done! Your MacBook will wake at 5:00am every day."
info ""
info "Verify with:  pmset -g sched"
info "View logs:    tail -f /var/log/macbook-wake.log"
info "             tail -f /var/log/macbook-post-wake.log"
info ""
warn "Make sure SSH / Remote Login is enabled in:"
warn "  System Settings → General → Sharing → Remote Login"
