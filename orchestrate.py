#!/usr/bin/env python3
"""
Process orchestrator — start, stop, and monitor configured processes.

Usage:
  ./orchestrate.py start   [name]   Start all enabled processes (or one by name)
  ./orchestrate.py stop    [name]   Stop all running processes (or one by name)
  ./orchestrate.py restart [name]   Stop then start
  ./orchestrate.py status           Show status of all configured processes
  ./orchestrate.py logs   [name]    Tail a process log (or the audit log if no name)
"""

import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("pyyaml not installed — run: pip3 install pyyaml  (or ./install.sh)")

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


def is_running(name: str) -> bool:
    pid = read_pid(name)
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        clear_pid(name)
        return False
    except PermissionError:
        return True  # process exists, no permission to signal


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
        return [expand(proc["path"])] + list(proc.get("args", []))
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
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
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

    setup_dirs()

    dispatch = {
        "start":   lambda: cmd_start(load_config(), name),
        "stop":    lambda: cmd_stop(load_config(), name),
        "restart": lambda: cmd_restart(load_config(), name),
        "status":  lambda: cmd_status(load_config()),
        "logs":    lambda: cmd_logs(name),
    }

    if cmd not in dispatch:
        sys.exit(f"Unknown command: {cmd!r}\n{USAGE}")

    dispatch[cmd]()


if __name__ == "__main__":
    main()
