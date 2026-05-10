# Deacon

Keeps a MacBook awake and orchestrates a daily automation stack: GWS/email agent, Dropbox organizer, bookmark sync, and any other processes defined in `config.yaml`.

## How it works

| Component | What it does |
|---|---|
| `pmset repeat` | Schedules a hardware wake at **7:00 AM** every day |
| `caffeinate -i` (LaunchAgent) | Prevents idle sleep while logged in |
| `orchestrate.py start` (LaunchAgent) | Launches all enabled processes at **7:05 AM** |

## Quick start

```bash
# 1. Install Python dependency
pip3 install -r requirements.txt

# 2. Copy and edit the config
cp config.example.yaml config.yaml
$EDITOR config.yaml

# 3. Install everything (requires sudo for pmset)
chmod +x install.sh uninstall.sh
./install.sh
```

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

## Files

```
orchestrate.py                        main CLI
config.yaml                           your process definitions (gitignored)
config.example.yaml                   template with all process types and actual stack
requirements.txt                      pyyaml
install.sh                            sets up pmset + LaunchAgents
uninstall.sh                          reverses install
dashboard/                            Vite React status dashboard
  src/App.jsx                         main component
  src/data.js                         architecture data (edit to match your stack)
launchd/
  com.user.caffeinate.plist           keeps Mac awake (installed to ~/Library/LaunchAgents)
  com.user.orchestrator.plist         runs orchestrate.py at 7:05 AM (REPO_DIR replaced at install)
logs/                                 gitignored, created at install time
pids/                                 gitignored, created at install time
```

## Notes

- `caffeinate -i` prevents idle sleep but allows display sleep. Change to `-d -i` in the plist to also keep the display on.
- `pmset repeat cancel` in `uninstall.sh` removes **all** repeating power schedules, not just this one.
- All processes start in **parallel** at 7:05 AM.
- Disabled processes (`enabled: false`) are skipped but stay in config for reference.
- The Dropbox organizer should run in **audit mode first** (read-only manifest) before enabling write mode — see `config.example.yaml`.
