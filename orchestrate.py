#!/usr/bin/env python
"""
Process orchestrator — start, stop, and monitor configured processes.

Usage:
  ./orchestrate.py start   [name]   Start all enabled processes (or one by name)
  ./orchestrate.py stop    [name]   Stop all running processes (or one by name)
  ./orchestrate.py restart [name]   Stop then start
  ./orchestrate.py status           Show status of all configured processes
  ./orchestrate.py logs   [name]    Tail a process log (or the audit log if no name)
  ./orchestrate.py serve  [port] [host]   Serve live status API + dashboard
                                          (default port 8765, host 127.0.0.1 —
                                          pass 0.0.0.0 to allow other devices
                                          on your network to reach it)
"""

import json
import mimetypes
import os
import re
import signal
import subprocess
import sys
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("pyyaml not installed — run: pip install pyyaml  (or ./install.sh)")

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.yaml"
LOG_DIR = BASE_DIR / "logs"
PID_DIR = BASE_DIR / "pids"
AUDIT_LOG = LOG_DIR / "audit.log"


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        sys.exit("config.yaml not found — copy config.example.yaml to get started.")
    with open(CONFIG_FILE) as f:
        return yaml.safe_load(f)


def setup_dirs():
    LOG_DIR.mkdir(exist_ok=True)
    PID_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def audit(event: str, name: str = "", detail: str = ""):
    ts = datetime.now().isoformat(timespec="seconds")
    line = f"{ts}  {event:<16}  {name:<24}  {detail}\n"
    with open(AUDIT_LOG, "a") as f:
        f.write(line)


# ---------------------------------------------------------------------------
# Process log helpers
# ---------------------------------------------------------------------------

def process_log_file(name: str) -> Path:
    d = LOG_DIR / name
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{datetime.now().strftime('%Y-%m-%d')}.log"


def open_log(name: str):
    lf = process_log_file(name)
    fh = open(lf, "a")
    fh.write(f"\n--- {datetime.now().isoformat()} ---\n")
    fh.flush()
    return fh, lf


# ---------------------------------------------------------------------------
# PID management
# ---------------------------------------------------------------------------

def pid_file(name: str) -> Path:
    return PID_DIR / f"{name}.pid"


def read_pid(name: str):
    try:
        return int(pid_file(name).read_text().strip())
    except (FileNotFoundError, ValueError):
        return None


def write_pid(name: str, pid: int):
    pid_file(name).write_text(str(pid))


def clear_pid(name: str):
    pf = pid_file(name)
    if pf.exists():
        pf.unlink()


def process_exists(pid: int) -> bool:
    """True if pid is still alive.

    Reaps it first via a non-blocking waitpid if we're its parent — orchestrate.py
    serve stays alive and directly parents processes started from the dashboard,
    so a fast-exiting child would otherwise sit as a zombie forever: zombies
    still answer os.kill(pid, 0) successfully, so without reaping they'd report
    as "running" indefinitely. (Not an issue for CLI-only usage, since that
    process exits immediately and orphans its children to launchd, which reaps
    them right away — waitpid here raises ChildProcessError for those, and we
    fall through to the plain kill-based check.)
    """
    try:
        waited_pid, _ = os.waitpid(pid, os.WNOHANG)
        if waited_pid == pid:
            return False
    except ChildProcessError:
        pass
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # process exists, no permission to signal


def is_running(name: str) -> bool:
    pid = read_pid(name)
    if pid is None:
        return False
    if process_exists(pid):
        return True
    clear_pid(name)
    return False


# ---------------------------------------------------------------------------
# Command builders per process type
# ---------------------------------------------------------------------------

def expand(path: str) -> str:
    return str(Path(path).expanduser().resolve())


def build_cmd(proc: dict) -> list:
    kind = proc["type"]
    if kind == "server":
        cmd = proc["command"]
        return ["bash", "-c", cmd] if isinstance(cmd, str) else list(cmd)
    elif kind == "claude":
        flags = proc.get("flags", ["-p"])
        return ["claude"] + flags + [proc["prompt"]]
    elif kind == "script":
        # `prompt`, if present, is always passed as the final argument — kept
        # in config.yaml (not hardcoded in the script) so it's one place to
        # read, edit, and diff, same as the `claude` type's `prompt`.
        extra = [proc["prompt"]] if "prompt" in proc else []
        return [expand(proc["path"])] + list(proc.get("args", [])) + extra
    else:
        raise ValueError(f"unknown process type: {kind!r}")


# ---------------------------------------------------------------------------
# Start / stop
# ---------------------------------------------------------------------------

def start_one(proc: dict):
    name = proc["name"]

    if not proc.get("enabled", True):
        print(f"  {name}: skipped (disabled)")
        return

    if is_running(name):
        print(f"  {name}: already running (pid {read_pid(name)})")
        return

    cwd = expand(proc["dir"]) if "dir" in proc else None
    env = {**os.environ, **proc.get("env", {})}

    try:
        cmd = build_cmd(proc)
    except ValueError as exc:
        print(f"  {name}: error — {exc}")
        audit("error", name, str(exc))
        return

    log_fh, log_path = open_log(name)
    try:
        p = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=log_fh, stderr=log_fh)
    except OSError as exc:
        print(f"  {name}: error — {exc}")
        audit("error", name, str(exc))
        return
    finally:
        log_fh.close()

    write_pid(name, p.pid)
    audit("start", name, f"pid={p.pid} type={proc['type']}")
    print(f"  {name}: started (pid {p.pid})  →  {log_path.relative_to(BASE_DIR)}")


def stop_one(name: str, timeout: int = 10):
    pid = read_pid(name)
    if not is_running(name):
        print(f"  {name}: not running")
        return

    try:
        os.kill(pid, signal.SIGTERM)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            time.sleep(0.1)
            if not process_exists(pid):
                break
        else:
            os.kill(pid, signal.SIGKILL)
            audit("kill", name, f"pid={pid} SIGKILL after {timeout}s")
            print(f"  {name}: killed (SIGKILL, pid {pid})")
            clear_pid(name)
            return
    except ProcessLookupError:
        pass

    clear_pid(name)
    audit("stop", name, f"pid={pid}")
    print(f"  {name}: stopped (pid {pid})")


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_start(config: dict, name: str = None):
    procs = _select(config, name)
    print("Starting:")
    for proc in procs:
        start_one(proc)


def cmd_stop(config: dict, name: str = None):
    procs = _select(config, name)
    print("Stopping:")
    for proc in procs:
        stop_one(proc["name"])


def cmd_restart(config: dict, name: str = None):
    procs = _select(config, name)
    print("Stopping:")
    for proc in procs:
        stop_one(proc["name"])
    time.sleep(1)
    print("Starting:")
    for proc in procs:
        start_one(proc)


def cmd_status(config: dict):
    print(f"\n{'NAME':<26} {'TYPE':<10} {'STATUS':<10} {'PID'}")
    print("─" * 56)
    for proc in config["processes"]:
        name = proc["name"]
        kind = proc["type"]
        if not proc.get("enabled", True):
            status, pid_str = "disabled", ""
        elif is_running(name):
            status, pid_str = "running", str(read_pid(name))
        else:
            status, pid_str = "stopped", ""
        print(f"{name:<26} {kind:<10} {status:<10} {pid_str}")
    print()


def cmd_logs(name: str = None):
    if name:
        log_dir = LOG_DIR / name
        logs = sorted(log_dir.glob("*.log")) if log_dir.exists() else []
        if not logs:
            sys.exit(f"No logs found for '{name}'.")
        target = str(logs[-1])
        print(f"→ {target}")
    else:
        target = str(AUDIT_LOG)
        print(f"→ {target}")
    os.execvp("tail", ["tail", "-f", target])


def process_detail(proc: dict) -> str:
    """One-line summary of what a process actually runs, for display."""
    kind = proc["type"]
    if kind == "script":
        return proc["path"]
    elif kind == "claude":
        return proc.get("dir", "")
    elif kind == "server":
        cmd = proc["command"]
        return cmd if isinstance(cmd, str) else " ".join(cmd)
    return ""


def status_json(config: dict) -> dict:
    """Return process status as a dict keyed by process id, for the dashboard API."""
    result = {}
    for proc in config["processes"]:
        name = proc["name"]
        pid = read_pid(name)
        running = is_running(name)
        log_path = process_log_file(name)

        last_line = ""
        if log_path.exists():
            try:
                lines = log_path.read_text().splitlines()
                last_line = next((l for l in reversed(lines) if l.strip() and not l.startswith("---")), "")
            except Exception:
                pass

        result[proc.get("id", name)] = {
            "name": name,
            # `type` drives how orchestrate.py builds the command (script/claude/
            # server) and shouldn't change; `role` is a purely cosmetic override
            # for the dashboard when that mechanism doesn't match how you'd
            # actually describe the process (e.g. a `script`-type entry that's
            # really a long-running server, or a client with no port of its own).
            "type": proc.get("role", proc["type"]),
            "detail": process_detail(proc),
            "status": "running" if running else ("disabled" if not proc.get("enabled", True) else "stopped"),
            "pid": pid if running else None,
            "log": last_line,
        }
    return result


def find_proc(config: dict, name: str):
    return next((p for p in config["processes"] if p["name"] == name), None)


RUN_MARKER = re.compile(r"^--- (.+?) ---$", re.MULTILINE)

# Strips ANSI color/cursor codes and collapses repeated CLI spinner frames
# (e.g. "⠋ drive_architect thinking…", "⠙ drive_architect thinking…", ...) —
# real terminal output re-rendering a spinner in place, which becomes
# hundreds of near-duplicate lines once captured to a flat log file.
ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")
SPINNER_RE = re.compile(r"^[⠀-⣿]\s+\S.*(thinking|working)[.…]*\s*$", re.IGNORECASE)


def clean_log_body(text: str) -> str:
    lines = (ANSI_RE.sub("", line) for line in text.splitlines())
    kept = [line for line in lines if not SPINNER_RE.match(line.strip())]
    return "\n".join(kept)


def format_timestamp(ts: str) -> str:
    try:
        return datetime.fromisoformat(ts).strftime("%b %d, %Y · %I:%M:%S %p")
    except ValueError:
        return ts


def log_entries(name: str) -> list:
    """Every run of `name`, newest first: {timestamp, label, body}.

    Each open_log() call writes a `--- <isoformat> ---` marker before a run's
    output; this splits per-day log files on those markers rather than
    changing the on-disk layout (still one file per day, per the README).
    """
    log_dir = LOG_DIR / name
    files = sorted(log_dir.glob("*.log")) if log_dir.exists() else []
    entries = []
    for f in files:
        text = f.read_text()
        marks = list(RUN_MARKER.finditer(text))
        if marks and marks[0].start() > 0:
            leading = clean_log_body(text[: marks[0].start()].strip("\n"))
            if leading:
                entries.append({"timestamp": "", "label": "(unknown time)", "body": leading})
        for i, m in enumerate(marks):
            start = m.end()
            end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
            ts = m.group(1)
            entries.append({
                "timestamp": ts,
                "label": format_timestamp(ts),
                "body": clean_log_body(text[start:end].strip("\n")),
            })
    entries.sort(key=lambda e: e["timestamp"], reverse=True)
    return entries


def set_enabled(name: str, enabled: bool) -> bool:
    """Flip a process's `enabled:` flag directly in config.yaml, preserving
    every comment and the existing formatting — a plain pyyaml load+dump
    would silently destroy both."""
    try:
        from ruamel.yaml import YAML
    except ImportError:
        sys.exit("ruamel.yaml not installed — run: pip install ruamel.yaml  (or ./install.sh)")

    yaml_rt = YAML()
    yaml_rt.preserve_quotes = True
    yaml_rt.indent(mapping=2, sequence=4, offset=2)  # match config.yaml's existing style
    with open(CONFIG_FILE) as f:
        data = yaml_rt.load(f)
    proc = next((p for p in data["processes"] if p["name"] == name), None)
    if proc is None:
        return False
    proc["enabled"] = enabled
    with open(CONFIG_FILE, "w") as f:
        yaml_rt.dump(data, f)
    return True


# ---------------------------------------------------------------------------
# Wake system status (launchd jobs, pmset schedule, wake logs)
# ---------------------------------------------------------------------------

LAUNCHD_JOBS = [
    {"label": "com.local.wake-scheduler", "kind": "daemon",
     "plist": "/Library/LaunchDaemons/com.local.wake-scheduler.plist",
     "desc": "Re-applies the pmset wake alarm at boot and 3:55 AM"},
    {"label": "com.local.post-wake", "kind": "daemon",
     "plist": "/Library/LaunchDaemons/com.local.post-wake.plist",
     "desc": "Post-wake: SSH check, IP log, awake 3hrs"},
    {"label": "com.user.orchestrator", "kind": "agent",
     "plist": str(Path.home() / "Library/LaunchAgents/com.user.orchestrator.plist"),
     "desc": "Runs orchestrate.py start shortly after wake"},
    {"label": "com.user.dashboard", "kind": "agent",
     "plist": str(Path.home() / "Library/LaunchAgents/com.user.dashboard.plist"),
     "desc": "Serves the dashboard continuously on 0.0.0.0:8765"},
]


def _launchctl_table(cmd: list) -> dict:
    """Run a `launchctl list` variant; return {label: {pid, status}}, or {}
    if the command fails (e.g. sudo -n with no cached credentials)."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
    except Exception:
        return {}
    if result.returncode != 0:
        return {}
    table = {}
    for line in result.stdout.splitlines()[1:]:  # skip "PID Status Label" header
        parts = line.split("\t")
        if len(parts) == 3:
            pid, status, label = parts
            table[label] = {"pid": None if pid == "-" else pid, "status": status}
    return table


def launchd_jobs_status() -> list:
    """Installed/active state for each of our launchd jobs.

    User LaunchAgents are queryable with a plain `launchctl list`. The two
    LaunchDaemons run as root, so their live state needs `sudo -n launchctl
    list` — a non-blocking check that fails instantly (never prompts) if sudo
    isn't already cached, in which case we report "unknown" rather than
    guessing "inactive".
    """
    user_table = _launchctl_table(["launchctl", "list"])
    sudo_result = subprocess.run(
        ["sudo", "-n", "launchctl", "list"], capture_output=True, text=True, timeout=5
    )
    have_sudo = sudo_result.returncode == 0
    system_table = {}
    if have_sudo:
        for line in sudo_result.stdout.splitlines()[1:]:
            parts = line.split("\t")
            if len(parts) == 3:
                pid, status, label = parts
                system_table[label] = {"pid": None if pid == "-" else pid, "status": status}

    jobs = []
    for job in LAUNCHD_JOBS:
        installed = Path(job["plist"]).exists()
        entry = (user_table if job["kind"] == "agent" else system_table).get(job["label"])
        if job["kind"] == "daemon" and not have_sudo:
            active = None  # can't tell without elevated permissions
        else:
            active = entry is not None
        jobs.append({
            "label": job["label"],
            "kind": job["kind"],
            "desc": job["desc"],
            "installed": installed,
            "active": active,
            "pid": entry["pid"] if entry else None,
            "last_exit": entry["status"] if entry else None,
        })
    return jobs


def wake_schedule() -> str:
    """The repeating pmset wake alarm, e.g. 'wakepoweron at 6:00AM every day'."""
    try:
        result = subprocess.run(["pmset", "-g", "sched"], capture_output=True, text=True, timeout=5)
    except Exception:
        return ""
    lines, out, in_repeating = result.stdout.splitlines(), [], False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("Repeating power events"):
            in_repeating = True
            continue
        if stripped.startswith("Scheduled power events") or (in_repeating and not stripped):
            break
        if in_repeating:
            out.append(stripped)
    return "; ".join(out) if out else "No repeating wake schedule set"


WAKE_LOG_LINE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[([\w-]+)\] (.*)$")


def last_wake_scheduler_run() -> dict:
    """Most recent schedule-wake.sh run, parsed from /var/log/macbook-wake.log."""
    path = Path("/var/log/macbook-wake.log")
    if not path.exists():
        return None
    try:
        lines = path.read_text().splitlines()
    except PermissionError:
        return {"error": "log exists but isn't readable without elevated permissions"}
    starts = [i for i, l in enumerate(lines) if "Setting repeating wake schedule" in l]
    if not starts:
        return None
    block = lines[starts[-1]:starts[-1] + 5]
    m = WAKE_LOG_LINE.match(block[0])
    return {
        "timestamp": m.group(1) if m else None,
        "ok": any("set successfully" in l for l in block) and not any("ERROR" in l for l in block),
        "message": block[0].split("] ", 1)[-1],
    }


def last_post_wake_run() -> dict:
    """Most recent post-wake.sh run, parsed from its log (/var/log, falling
    back to /tmp — the script tees to both; see scripts/post-wake.sh)."""
    for path in (Path("/var/log/macbook-post-wake.log"), Path("/tmp/macbook-post-wake.log")):
        if not path.exists():
            continue
        try:
            lines = path.read_text().splitlines()
        except PermissionError:
            continue
        starts = [i for i, l in enumerate(lines) if "Post-wake routine started" in l]
        if not starts:
            continue
        block = lines[starts[-1]:]
        completed = any("Post-wake routine complete" in l for l in block)
        warnings = [l.split("] ", 1)[-1] for l in block if "WARNING" in l]
        m = WAKE_LOG_LINE.match(block[0])
        return {
            "timestamp": m.group(1) if m else None,
            "ok": completed and not warnings,
            "completed": completed,
            "warnings": warnings,
            "source": str(path),
        }
    return None


def system_status() -> dict:
    return {
        "jobs": launchd_jobs_status(),
        "wake_schedule": wake_schedule(),
        "last_wake_scheduler_run": last_wake_scheduler_run(),
        "last_post_wake_run": last_post_wake_run(),
    }


def cmd_serve(port: int = 8765, host: str = "127.0.0.1"):
    """Serve live status JSON API consumed by the dashboard."""
    config = load_config()
    dashboard_dir = BASE_DIR / "dashboard" / "dist"

    class Handler(BaseHTTPRequestHandler):
        def _json(self, obj, code=200):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/api/status":
                self._json(status_json(load_config()))
            elif self.path == "/api/system":
                self._json(system_status())
            elif self.path.startswith("/api/logs/"):
                name = self.path[len("/api/logs/"):]
                if find_proc(load_config(), name) is None:
                    self._json({"error": f"unknown process: {name}"}, 404)
                    return
                self._json({"entries": log_entries(name)})
            elif self.path.startswith("/api/config/"):
                name = self.path[len("/api/config/"):]
                proc = find_proc(load_config(), name)
                if proc is None:
                    self._json({"error": f"unknown process: {name}"}, 404)
                    return
                self._json(proc)
            elif dashboard_dir.exists():
                # Serve the built dashboard
                file_path = dashboard_dir / (self.path.lstrip("/") or "index.html")
                if not file_path.exists():
                    file_path = dashboard_dir / "index.html"
                try:
                    body = file_path.read_bytes()
                    ct = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
                    self.send_response(200)
                    self.send_header("Content-Type", ct)
                    self.end_headers()
                    self.wfile.write(body)
                except Exception:
                    self.send_response(404)
                    self.end_headers()
            else:
                msg = b"Dashboard not built. Run: cd dashboard && npm install && npm run build"
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(msg)

        def do_POST(self):
            parts = self.path.split("/")
            if len(parts) != 4 or parts[1] != "api" or parts[2] not in ("start", "stop", "enable", "disable"):
                self._json({"error": "not found"}, 404)
                return
            action, name = parts[2], parts[3]
            cfg = load_config()
            proc = find_proc(cfg, name)
            if proc is None:
                self._json({"error": f"unknown process: {name}"}, 404)
                return
            if action == "start":
                start_one(proc)
            elif action == "stop":
                stop_one(name)
            else:
                set_enabled(name, action == "enable")
            self._json(status_json(load_config()))

        def log_message(self, fmt, *args):
            pass  # suppress request noise

    print(f"Serving status API at http://{host}:{port}/api/status")
    if dashboard_dir.exists():
        print(f"Dashboard at http://{host}:{port}/")
    else:
        print("Tip: build the dashboard first — cd dashboard && npm install && npm run build")
    if host != "127.0.0.1":
        print(
            "WARNING: bound to a non-localhost address — this API can start real "
            "processes (including live Claude/gws agent runs) with no authentication, "
            "so anything else on this network can reach it too."
        )
    HTTPServer((host, port), Handler).serve_forever()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _select(config: dict, name: str = None) -> list:
    procs = config["processes"]
    if name is None:
        return procs
    matches = [p for p in procs if p["name"] == name]
    if not matches:
        sys.exit(f"Unknown process: {name!r}")
    return matches


USAGE = __doc__


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(USAGE)
        sys.exit(0)

    cmd = args[0]
    name = args[1] if len(args) > 1 else None
    host = args[2] if len(args) > 2 else "127.0.0.1"

    setup_dirs()

    dispatch = {
        "start":   lambda: cmd_start(load_config(), name),
        "stop":    lambda: cmd_stop(load_config(), name),
        "restart": lambda: cmd_restart(load_config(), name),
        "status":  lambda: cmd_status(load_config()),
        "logs":    lambda: cmd_logs(name),
        "serve":   lambda: cmd_serve(int(name) if name else 8765, host),
    }

    if cmd not in dispatch:
        sys.exit(f"Unknown command: {cmd!r}\n{USAGE}")

    dispatch[cmd]()


if __name__ == "__main__":
    main()
