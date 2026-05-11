# MacBook Wake Automation

Wakes your MacBook Air from sleep at **5:00am every morning** so you can connect remotely via SSH, Terminus, Claude remote control, etc.

## How it works

| Component | What it does |
|-----------|-------------|
| `pmset repeat` | Hardware-level alarm — wakes the Mac even from deep sleep |
| `com.local.wake-scheduler` | LaunchDaemon that re-applies the pmset schedule at boot and 4:55am (in case it gets cleared by OS updates) |
| `com.local.post-wake` | LaunchDaemon that fires at 5:00am — keeps Mac awake, verifies SSH, logs your IP |

> **Key launchd behavior:** `StartCalendarInterval` jobs that were missed during sleep are fired immediately after wake. So even if the Mac was asleep at exactly 5:00am, `post-wake.sh` runs right after it comes online.

## Install

```bash
git clone <this-repo>
cd macbook-wake
sudo bash setup.sh
```

## Verify

```bash
# Confirm the wake schedule is set
pmset -g sched

# Watch the logs
tail -f /var/log/macbook-wake.log
tail -f /var/log/macbook-post-wake.log
```

## Adjust the wake time

Edit `scripts/schedule-wake.sh` and change `WAKE_TIME`, then re-run `sudo bash setup.sh`.

Or directly:
```bash
sudo pmset repeat wakeorpoweron MTWRFSU 06:00:00  # e.g. 6am
```

## Connecting from your phone (Terminus → Claude Code)

At 5am the Mac wakes, then `post-wake.sh` automatically starts a `tmux` session with Claude Code CLI open in your project directory.

**From Terminus (or any SSH app):**
```bash
ssh you@your-mac-ip        # or: ssh you@your-mac.local
tmux attach -t claude      # attach to the waiting Claude Code session
```

That's it — you're dropped straight into Claude Code in your project.

**If Claude Code isn't installed yet** (the script will warn you):
```bash
npm install -g @anthropic-ai/claude-code
```

**If tmux isn't installed:**
```bash
brew install tmux
```

**Set your project directory** in `post-wake.sh` before running `setup.sh`:
```bash
# Line near the top of scripts/post-wake.sh
CLAUDE_PROJECT_DIR="$HOME/Projects/my-app"
```

## Remote access prerequisites

The post-wake script enables SSH automatically, but double-check once manually:

- **System Settings → General → Sharing → Remote Login** → On
- Note your Mac's local IP or use a service like [Tailscale](https://tailscale.com) for reliable remote access regardless of IP changes

## Uninstall

```bash
sudo bash uninstall.sh
```

## Files

```
macbook-wake/
├── setup.sh                              # One-time installer
├── uninstall.sh                          # Remove everything
├── scripts/
│   ├── schedule-wake.sh                  # Sets pmset repeating wake alarm
│   └── post-wake.sh                      # Post-wake: caffeinate, SSH check, IP log
└── launchd/
    ├── com.local.wake-scheduler.plist    # LaunchDaemon for schedule-wake.sh
    └── com.local.post-wake.plist         # LaunchDaemon for post-wake.sh
```
