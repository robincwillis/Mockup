# Deacon

Keeps a MacBook awake and orchestrates a daily automation stack: GWS/email agent, Dropbox organizer, and any other processes defined in `config.yaml`.

## How it works

| Component | What it does |
|---|---|
| `com.local.wake-scheduler` (LaunchDaemon) | Re-applies the `pmset` wake alarm at boot and at 4:55 AM (in case it gets cleared by OS updates) |
| `pmset repeat` | Hardware-level alarm — wakes the Mac at the configured time even from deep sleep |
| `com.user.caffeinate` (LaunchAgent) | Prevents idle sleep while logged in (`caffeinate -i`) |
| `com.user.orchestrator` (LaunchAgent) | Runs `orchestrate.py start` shortly after wake |
| `com.user.dashboard` (LaunchAgent) | Runs `orchestrate.py serve` continuously, bound to `0.0.0.0` so the dashboard is reachable from other devices on your network (e.g. your phone) — see the security note below |
| `com.local.post-wake` (LaunchDaemon, optional) | Fires after wake — verifies SSH is enabled and logs your IP |

> **Security note:** `com.user.dashboard` binds to `0.0.0.0`, not `127.0.0.1` — anything else on the same network can reach it, not just your phone. Its API can start/stop/enable processes (including live Claude/gws agent runs) with no authentication. Only use this on a network you trust.

> **Key launchd behavior:** `StartCalendarInterval` jobs that were missed during sleep fire immediately after wake. So even if the Mac was asleep at the scheduled time, the post-wake job runs right after it comes online.

## Quick start

```bash
# 1. Set up a virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Copy and edit the config
cp config.example.yaml config.yaml
$EDITOR config.yaml

# 3. Install everything (requires sudo for pmset + LaunchDaemons)
chmod +x install.sh uninstall.sh
./install.sh
```

> **Note:** the venv above is for running `./orchestrate.py` manually (`status`, `start`, `serve`, testing). `install.sh` installs `requirements.txt` system-wide via `pip`, and the `com.user.orchestrator` LaunchAgent invokes `/usr/bin/python3` directly (a hardcoded absolute path — launchd jobs don't see your shell's aliases/PATH at all, and `/usr/bin/python` doesn't exist on macOS) — LaunchAgents don't activate virtualenvs — so the scheduled wake-time job relies on that system-wide install, not the venv.

## Dashboard

A React dashboard visualises the automation stack and — when `orchestrate.py serve` is running — shows live process status.

```bash
cd dashboard
npm install
npm run dev        # http://localhost:5173  (proxies /api → orchestrate.py serve)
```

To run the live status API alongside the dashboard:

```bash
./orchestrate.py serve    # http://localhost:8765/api/status
```

To build and serve everything from a single process:

```bash
cd dashboard && npm run build && cd ..
./orchestrate.py serve    # http://localhost:8765/ serves the built dashboard + API
```

## Process types

Define processes in `config.yaml`. Three types are supported:

### `server` — long-running local servers

```yaml
- name: my-app
  type: server
  enabled: true
  dir: ~/Projects/my-app
  command: npm start          # string (bash -c) or list of args
  env:
    NODE_ENV: development
    PORT: "3000"
```

### `claude` — Claude Code CLI invocations

```yaml
- name: dropbox-audit
  type: claude
  enabled: true
  dir: ~/Projects/dropbox-organizer
  flags: [-p]
  prompt: |
    Run a read-only audit pass. Produce a manifest of files that should
    be reorganized. Do NOT move or delete anything. Stop after 30 minutes.
```

Runs `claude -p "<prompt>"` in the given directory. Output captured to the process log.

### `script` — arbitrary shell scripts

```yaml
- name: gws-email
  type: script
  enabled: true
  path: ~/Projects/gws-agent/run.sh
  args: [--task, email]
  env:
    GOOGLE_CLOUD_PROJECT: your-project-id
```

## Managing processes

```bash
./orchestrate.py status            # show all process statuses
./orchestrate.py start             # start all enabled processes
./orchestrate.py start  my-app     # start one process by name
./orchestrate.py stop              # stop all running processes
./orchestrate.py stop   my-app     # stop one process
./orchestrate.py restart my-app    # stop then start
./orchestrate.py logs              # tail the audit log
./orchestrate.py logs   my-app     # tail today's log for a process
./orchestrate.py serve  [port]     # live status API + dashboard (default 8765)
```

## Logs and observability

```
logs/
├── audit.log              # timestamped record of every start/stop/kill/error
└── <process-name>/
    └── YYYY-MM-DD.log     # stdout + stderr for each process, per day
```

Audit log format:

```
2025-01-15T07:05:02  start             gws-email                 pid=12345 type=script
2025-01-15T07:05:02  start             dropbox-audit             pid=12346 type=claude
2025-01-15T07:35:10  stop              dropbox-audit             pid=12346
```

Wake-automation logs (from the LaunchDaemons) live separately:

```
/var/log/macbook-wake.log         # schedule-wake.sh — confirms pmset re-applied at boot
/var/log/macbook-post-wake.log    # post-wake.sh — SSH check, IP log
```

## Verify

```bash
# Confirm the wake schedule is set
pmset -g sched

# Watch the wake-automation logs
tail -f /var/log/macbook-wake.log
tail -f /var/log/macbook-post-wake.log
```

## Adjust the wake time

Edit `scripts/schedule-wake.sh` and change `WAKE_TIME`, then re-run `./install.sh`.

Or directly:

```bash
sudo pmset repeat wakeorpoweron MTWRFSU 06:00:00  # e.g. 6am
```

## Remote access prerequisites

The post-wake script enables SSH automatically, but double-check once manually:

- **System Settings → General → Sharing → Remote Login** → On
- Note your Mac's local IP or use a service like [Tailscale](https://tailscale.com) for reliable remote access regardless of IP changes

## Files

```
orchestrate.py                            main CLI
config.yaml                               your process definitions (gitignored)
config.example.yaml                       template with all process types and actual stack
requirements.txt                          pyyaml
install.sh                                sets up pmset + LaunchAgents + LaunchDaemons
uninstall.sh                              reverses install
dashboard/                                Vite React status dashboard
  src/App.jsx                             main component
  src/data.js                             architecture data (edit to match your stack)
scripts/
  schedule-wake.sh                        re-applies pmset wake alarm (run by LaunchDaemon)
  post-wake.sh                            post-wake: caffeinate, SSH check, IP log
launchd/
  com.user.caffeinate.plist               keeps Mac awake (installed to ~/Library/LaunchAgents)
  com.user.orchestrator.plist             runs orchestrate.py at wake (REPO_DIR replaced at install)
  com.user.dashboard.plist                runs orchestrate.py serve on 0.0.0.0:8765, continuously
  com.local.wake-scheduler.plist          LaunchDaemon for schedule-wake.sh (/Library/LaunchDaemons)
  com.local.post-wake.plist               LaunchDaemon for post-wake.sh (/Library/LaunchDaemons)
logs/                                     gitignored, created at install time
pids/                                     gitignored, created at install time
```

## Uninstall

```bash
./uninstall.sh
```

## Notes

- `caffeinate -i` prevents idle sleep but allows display sleep. Change to `-d -i` in the plist to also keep the display on.
- `pmset repeat cancel` in `uninstall.sh` removes **all** repeating power schedules, not just this one.
- All processes start in **parallel** at wake time.
- Disabled processes (`enabled: false`) are skipped but stay in config for reference.
- The Dropbox organizer should run in **audit mode first** (read-only manifest) before enabling write mode — see `config.example.yaml`.
