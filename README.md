# macbook-wake

Keeps a MacBook awake and runs a configurable set of processes (servers, Claude Code tasks, shell scripts) every morning at 7:05 AM.

## How it works

| Component | What it does |
|---|---|
| `pmset repeat` | Schedules a hardware wake at **7:00 AM** every day |
| `caffeinate -i` (LaunchAgent) | Prevents idle sleep while logged in |
| `orchestrate.py start` (LaunchAgent) | Launches all enabled processes at **7:05 AM** |

## Quick start

```bash
# 1. Copy and edit the config
cp config.example.json config.json
$EDITOR config.json

# 2. Install everything (requires sudo for pmset)
chmod +x install.sh uninstall.sh
./install.sh
```

## Process types

Define processes in `config.json`. Three types are supported:

### `server` — long-running local servers

```json
{
  "name": "my-app",
  "type": "server",
  "enabled": true,
  "dir": "~/Projects/my-app",
  "command": "npm start",
  "env": { "NODE_ENV": "development" }
}
```

`command` can be a string (run via `bash -c`) or a list of arguments.

### `claude` — Claude Code CLI invocations

```json
{
  "name": "daily-review",
  "type": "claude",
  "enabled": true,
  "dir": "~/Projects/my-app",
  "prompt": "Review commits since yesterday and flag any issues.",
  "flags": ["-p"]
}
```

Runs `claude -p "<prompt>"` in the given directory. Output is captured to the process log.

### `script` — arbitrary shell scripts

```json
{
  "name": "backup",
  "type": "script",
  "enabled": true,
  "path": "~/scripts/backup.sh",
  "args": ["--verbose"]
}
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
```

## Logs and observability

```
logs/
├── audit.log              # timestamped record of every start/stop/kill/error
└── <process-name>/
    └── YYYY-MM-DD.log     # stdout + stderr for each process, per day
```

The audit log format is:

```
2025-01-15T07:05:02  start             my-app                    pid=12345 type=server
2025-01-15T07:05:02  start             daily-review              pid=12346 type=claude
2025-01-15T18:30:00  stop              my-app                    pid=12345
```

## Uninstall

```bash
./uninstall.sh
```

Cancels the pmset schedule and unloads both LaunchAgents. Logs and pids directories are left intact.

## Files

```
orchestrate.py                        main CLI
config.json                           your process definitions (not committed)
config.example.json                   template showing all process types
install.sh                            sets up pmset + LaunchAgents
uninstall.sh                          reverses install
launchd/
  com.user.caffeinate.plist           keeps Mac awake (installed to ~/Library/LaunchAgents)
  com.user.orchestrator.plist         runs orchestrate.py at 7:05 AM (REPO_DIR replaced at install)
logs/                                 git-ignored, created at install time
pids/                                 git-ignored, created at install time
```

## Notes

- `caffeinate -i` prevents idle sleep but allows display sleep. Change to `-d -i` in the plist to also keep the screen on.
- `pmset repeat cancel` in `uninstall.sh` removes **all** repeating power schedules, not just the one added here.
- All processes start in parallel at 7:05 AM.
- Disabled processes (`"enabled": false`) are skipped but remain in the config for reference.
