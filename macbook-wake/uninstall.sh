#!/bin/bash
# uninstall.sh — Removes the MacBook wake automation.
# Run with: sudo bash uninstall.sh

set -e

INSTALL_DIR="/usr/local/bin/macbook-wake"
PLIST_DIR="/Library/LaunchDaemons"

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[uninstall]${NC} $*"; }
error() { echo -e "${RED}[uninstall]${NC} $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && error "Please run as root: sudo bash uninstall.sh"

info "Removing MacBook wake automation..."

for plist in com.local.wake-scheduler com.local.post-wake; do
    DEST="$PLIST_DIR/$plist.plist"
    if [ -f "$DEST" ]; then
        launchctl unload -w "$DEST" 2>/dev/null || true
        rm -f "$DEST"
        info "Removed $DEST"
    fi
done

if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    info "Removed $INSTALL_DIR"
fi

# Clear the pmset repeating wake schedule
pmset repeat cancel 2>/dev/null && info "Cleared pmset wake schedule."

info "Uninstall complete."
