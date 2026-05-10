# macbook-wake

Scripts to wake a MacBook from sleep at 7:00 AM every day and keep it awake while logged in.

## How it works

- **Wake schedule** — uses `pmset repeat` to schedule a daily hardware wake at 7:00 AM (all days). Requires `sudo`.
- **Stay awake** — installs a launchd `LaunchAgent` that runs `caffeinate -i` at login and keeps it alive, preventing idle sleep.

## Install

```bash
chmod +x install.sh uninstall.sh
./install.sh
```

## Uninstall

```bash
./uninstall.sh
```

`uninstall.sh` cancels the pmset wake schedule and unloads/removes the caffeinate agent.

## Files

```
install.sh                          # sets pmset schedule + installs launchd agent
uninstall.sh                        # reverses everything
launchd/com.user.caffeinate.plist   # LaunchAgent definition
```

## Notes

- The caffeinate flag `-i` prevents idle sleep but allows display sleep. Change to `-d` (or add both) if you also want to keep the display on.
- `pmset repeat cancel` in `uninstall.sh` removes **all** repeating power schedules, not just the one added here.
- macOS may require Full Disk Access or Security settings to honour `pmset` on newer OS versions.
