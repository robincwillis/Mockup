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
