#!/bin/bash
# post-wake.sh
# Runs at 5:00am via LaunchDaemon (fires after wake due to StartCalendarInterval).
# Ensures the Mac is ready for remote access via SSH, Claude Code CLI, Terminus, etc.

# ── Configuration ────────────────────────────────────────────────────────────
# Directory Claude Code CLI will open in. Edit this to your project path.
CLAUDE_PROJECT_DIR="$HOME/Projects"

# tmux session name — attach with: tmux attach -t claude
TMUX_SESSION="claude"
# ─────────────────────────────────────────────────────────────────────────────

LOG="/tmp/macbook-post-wake.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [post-wake] $*" | tee -a "$LOG"
}

log "=== Post-wake routine started ==="

# ── 1. Keep Mac awake for 4 hours (prevents it going back to sleep too soon)
#       -t seconds: timeout   -s: prevent system sleep
log "Asserting caffeinate for 1 hour (sleeps at 7am if idle)..."
caffeinate -s -t 3600 &
CAFE_PID=$!
log "caffeinate PID: $CAFE_PID"

# ── 2. Verify network is reachable (retry up to 30s)
log "Waiting for network..."
for i in $(seq 1 30); do
    if /sbin/ping -c 1 -t 1 8.8.8.8 &>/dev/null; then
        log "Network reachable (attempt $i)."
        break
    fi
    sleep 1
done

# ── 3. Ensure Remote Login (SSH) is enabled
SSH_STATUS=$(systemsetup -getremotelogin 2>/dev/null | awk '{print $NF}')
if [ "$SSH_STATUS" != "On" ]; then
    log "SSH was off — enabling Remote Login..."
    systemsetup -setremotelogin on
else
    log "SSH is already enabled."
fi

# ── 4. Log current IP addresses for reference
log "Network interfaces:"
ifconfig | grep "inet " | grep -v "127.0.0.1" | tee -a "$LOG"

# ── 5. Optional: send a macOS notification so you know the Mac is awake
#       (visible on the Mac's screen / Notification Center)
CURRENT_USER=$(stat -f "%Su" /dev/console)
if [ -n "$CURRENT_USER" ]; then
    sudo -u "$CURRENT_USER" osascript -e \
        'display notification "MacBook is awake and ready for remote access." with title "Good Morning" sound name "Ping"' \
        2>/dev/null && log "Sent wake notification to $CURRENT_USER."
fi

# ── 6. Start a persistent tmux session with Claude Code CLI
#       If the session already exists (e.g. Mac wasn't fully asleep), skip.
CURRENT_USER=$(stat -f "%Su" /dev/console 2>/dev/null)
if [ -n "$CURRENT_USER" ]; then
    TMUX_BIN=$(sudo -u "$CURRENT_USER" which tmux 2>/dev/null || echo "/opt/homebrew/bin/tmux")
    CLAUDE_BIN=$(sudo -u "$CURRENT_USER" which claude 2>/dev/null || echo "$HOME/.npm-global/bin/claude")

    if [ -x "$TMUX_BIN" ]; then
        # Kill any stale session from a previous wake cycle
        sudo -u "$CURRENT_USER" "$TMUX_BIN" has-session -t "$TMUX_SESSION" 2>/dev/null && \
            sudo -u "$CURRENT_USER" "$TMUX_BIN" kill-session -t "$TMUX_SESSION" 2>/dev/null

        if [ -x "$CLAUDE_BIN" ]; then
            # Start tmux with Claude Code CLI already running in the project dir
            sudo -u "$CURRENT_USER" "$TMUX_BIN" new-session -d -s "$TMUX_SESSION" \
                -c "$CLAUDE_PROJECT_DIR" \
                "$CLAUDE_BIN"
            log "Started tmux session '$TMUX_SESSION' with Claude Code in $CLAUDE_PROJECT_DIR"
        else
            # claude not found — open a plain shell in the project dir
            sudo -u "$CURRENT_USER" "$TMUX_BIN" new-session -d -s "$TMUX_SESSION" \
                -c "$CLAUDE_PROJECT_DIR"
            log "WARNING: claude CLI not found at $CLAUDE_BIN — started plain shell session."
            log "Install with: npm install -g @anthropic-ai/claude-code"
        fi
    else
        log "WARNING: tmux not found. Install with: brew install tmux"
        log "SSH in and run: tmux new -s $TMUX_SESSION -c $CLAUDE_PROJECT_DIR"
    fi
fi

log "=== Post-wake routine complete ==="
log "To connect: ssh <user>@<mac-ip> then: tmux attach -t $TMUX_SESSION"
