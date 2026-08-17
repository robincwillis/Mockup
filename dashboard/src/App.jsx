import { useState, useEffect } from "react";
import { systems, crossCutting, phaseMap } from "./data.js";

// Design tokens — light theme (paper background, dark grey type).
// Deliberately minimal: ACCENT is the only color in the whole app, used for
// active/positive state and primary CTAs. Everything else — including
// "stopped"/"disabled"/"issue" — is plain neutral grey, distinguished by
// text and icon, not hue.
const INK = "#18181b";       // primary text
const INK_SOFT = "#52525b";  // secondary text / prose
const INK_MUTED = "#82828c"; // muted labels
const INK_FAINT = "#a8a8b2"; // faintest meta text
const PAPER = "#f0f0ee";     // page background
const PANEL = "#e9e9e6";     // card background — close to page background
const INSET = "#dfdfdc";     // nested/inset background (pills, log boxes)

const ACCENT = "#2563eb";    // the one accent color, for primary CTAs
const DARK = "#27272a";      // secondary CTA fill (Stop, Disable) — white text on dark

// Fetch live process status from orchestrate.py serve (/api/status).
// Falls back gracefully if the API is not running.
function useLiveStatus() {
  const [liveStatus, setLiveStatus] = useState({});
  const [connected, setConnected] = useState(false);

  const poll = () =>
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setLiveStatus(data);
        setConnected(true);
      })
      .catch(() => setConnected(false));

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  return { liveStatus, connected, refresh: poll };
}

// Fetch launchd/pmset wake-system status (/api/system). Polls slowly —
// this data (installed jobs, wake schedule, last-run logs) barely changes.
function useSystemStatus() {
  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    const poll = () =>
      fetch("/api/system")
        .then((r) => r.json())
        .then(setSystemStatus)
        .catch(() => {});
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  return systemStatus;
}

const STATUS_STYLE = {
  running:  { label: "Running",  color: ACCENT },
  stopped:  { label: "Stopped",  color: INK_MUTED },
  disabled: { label: "Disabled", color: INK_MUTED },
  // legacy statuses used by the roadmap's static system cards
  active:        { label: "Active",      color: ACCENT },
  "in-progress": { label: "In Progress", color: INK_MUTED },
  planned:       { label: "Planned",     color: INK_MUTED },
};

const TYPE_STYLE = {
  script: { label: "script", icon: "📜" },
  claude: { label: "claude", icon: "🤖" },
  server: { label: "server", icon: "🖥"  },
  client: { label: "client", icon: "📱" },
};

// Shared sizing so badges and buttons align in a row.
const PILL = { fontSize: "13px", padding: "8px 16px", border: "none" };

function StatusBadge({ status, liveOverride }) {
  const resolved = liveOverride || status;
  const s = STATUS_STYLE[resolved] || STATUS_STYLE.planned;
  return (
    <span style={{
      background: INSET, color: s.color,
      ...PILL, borderRadius: "6px", letterSpacing: "0.02em",
      whiteSpace: "nowrap", display: "inline-block",
    }}>{s.label}</span>
  );
}

async function postAction(action, name) {
  const res = await fetch(`/api/${action}/${name}`, { method: "POST" });
  return res.json();
}

function ActionButton({ proc, id, pending, onAction }) {
  if (proc.status === "disabled") {
    return (
      <button disabled title="disabled in config.yaml" style={{
        background: INSET, color: INK_FAINT,
        ...PILL, borderRadius: "6px", cursor: "not-allowed",
      }}>Start</button>
    );
  }
  const isRunning = proc.status === "running";
  const label = pending ? "…" : isRunning ? "Stop" : "Start";
  return (
    <button
      disabled={pending}
      onClick={() => onAction(isRunning ? "stop" : "start", id)}
      style={{
        background: isRunning ? DARK : `${ACCENT}18`,
        color: isRunning ? "#ffffff" : ACCENT,
        ...PILL, borderRadius: "6px",
        cursor: pending ? "default" : "pointer", minWidth: "64px",
      }}
    >{label}</button>
  );
}

function EnableButton({ proc, id, pending, onAction }) {
  const isEnabled = proc.status !== "disabled";
  const label = pending ? "…" : isEnabled ? "Disable" : "Enable";
  return (
    <button
      disabled={pending}
      onClick={() => onAction(isEnabled ? "disable" : "enable", id)}
      title={isEnabled ? "Disable in config.yaml" : "Enable in config.yaml"}
      style={{
        background: isEnabled ? DARK : `${ACCENT}18`,
        color: isEnabled ? "#ffffff" : ACCENT,
        ...PILL, borderRadius: "6px",
        cursor: pending ? "default" : "pointer", minWidth: "72px",
      }}
    >{label}</button>
  );
}

function ProcessRow({ id, proc, pending, onAction, onDetails }) {
  const type = TYPE_STYLE[proc.type] || { label: proc.type, icon: "▪" };
  const isDisabled = proc.status === "disabled";
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
      background: PANEL, borderRadius: "10px", padding: "8px 16px",
    }}>
      <div style={{ width: "280px", flexShrink: 0, overflow: "hidden" }}>
        <div style={{
          color: isDisabled ? INK_FAINT : INK, fontWeight: "400", fontSize: "18px", marginBottom: "8px",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textTransform: "uppercase",
        }} title={id}>{id}</div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "12px" }}>{type.icon}</span>
          <span style={{
            color: isDisabled ? INK_FAINT : INK_MUTED, fontSize: "12px",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>{type.label}</span>
        </span>
      </div>

      <div style={{
        flex: "1 1 160px", minWidth: 0, color: INK_MUTED, fontSize: "13px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }} title={proc.log}>{proc.log}</div>

      {proc.pid && (
        <span style={{ color: INK_FAINT, fontSize: "13px", flexShrink: 0 }}>pid {proc.pid}</span>
      )}

      <div style={{ flexShrink: 0 }}><StatusBadge status={proc.status} /></div>

      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <ActionButton proc={proc} id={id} pending={pending} onAction={onAction} />
        <button onClick={() => onDetails(id)} style={{
          background: "transparent", color: INK_MUTED,
          ...PILL, borderRadius: "6px", cursor: "pointer",
        }}>Details</button>
      </div>
    </div>
  );
}

const CONFIG_FIELD_ORDER = ["type", "role", "enabled", "path", "dir", "command", "flags", "args"];

function ConfigView({ config }) {
  if (config === null) return <div style={{ color: INK_MUTED, fontSize: "15px" }}>Loading…</div>;
  const { name, prompt, ...rest } = config;
  const keys = [
    ...CONFIG_FIELD_ORDER.filter((k) => k in rest),
    ...Object.keys(rest).filter((k) => !CONFIG_FIELD_ORDER.includes(k)),
  ];
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: prompt ? "22px" : 0 }}>
        {keys.map((k) => (
          <div key={k} style={{ display: "flex", gap: "12px", fontSize: "14px" }}>
            <span style={{ color: INK_MUTED, width: "70px", flexShrink: 0 }}>{k}</span>
            <span style={{ color: INK_SOFT, wordBreak: "break-word" }}>
              {Array.isArray(rest[k]) ? rest[k].join(" ") : String(rest[k])}
            </span>
          </div>
        ))}
      </div>
      {prompt && (
        <div>
          <div style={{
            color: ACCENT, fontSize: "13px",
            letterSpacing: "0.05em", marginBottom: "8px",
          }}>PROMPT</div>
          <pre style={{
            background: INSET, borderRadius: "8px", padding: "14px 16px",
            color: INK, fontSize: "14px", lineHeight: "1.6",
            whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
          }}>{prompt}</pre>
        </div>
      )}
    </div>
  );
}

function LogEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: INSET, borderRadius: "8px", overflow: "hidden" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          width: "100%", background: "transparent", border: "none", cursor: "pointer",
          padding: "14px 16px", textAlign: "left", fontFamily: "inherit",
        }}
      >
        <span style={{ color: ACCENT, fontSize: "13px", letterSpacing: "0.05em" }}>{entry.label}</span>
        <span style={{ color: INK_MUTED, fontSize: "15px" }}>{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <pre style={{
          color: INK_SOFT, fontSize: "14px", lineHeight: "1.9",
          whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
          padding: "0 16px 16px",
        }}>{entry.body}</pre>
      )}
    </div>
  );
}

function DetailsDrawer({ id, proc, entries, config, onClose, pending, onAction }) {
  const [tab, setTab] = useState("logs");
  if (!id) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "#00000050", zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: "min(640px, 100vw)",
        background: PANEL, boxShadow: "-8px 0 30px rgba(0,0,0,0.10)", padding: "26px",
        overflowY: "auto", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ color: INK, fontWeight: "400", fontSize: "18px" }}>{id}</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {proc && <EnableButton proc={proc} id={id} pending={pending} onAction={onAction} />}
            <button onClick={onClose} style={{
              background: "transparent", color: INK_MUTED,
              ...PILL, borderRadius: "6px", cursor: "pointer",
            }}>✕</button>
          </div>
        </div>

        <div style={{
          display: "flex", gap: "4px", marginBottom: "20px", background: INSET,
          borderRadius: "8px", padding: "4px", width: "fit-content",
        }}>
          {["logs", "config"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? PANEL : "transparent",
              color: tab === t ? INK : INK_MUTED,
              border: "none",
              borderRadius: "6px", padding: "6px 16px", cursor: "pointer",
              fontSize: "13px", letterSpacing: "0.05em",
              textTransform: "uppercase", transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>

        {tab === "logs" && (
          <>
            {entries === null && <div style={{ color: INK_MUTED, fontSize: "15px" }}>Loading…</div>}
            {entries !== null && entries.length === 0 && (
              <div style={{ color: INK_MUTED, fontSize: "15px" }}>No logs yet.</div>
            )}
            {entries !== null && entries.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {entries.map((e, i) => <LogEntry key={i} entry={e} />)}
              </div>
            )}
          </>
        )}

        {tab === "config" && <ConfigView config={config} />}
      </div>
    </div>
  );
}

function ProcessesTab({ liveStatus, connected, refresh }) {
  const [pendingId, setPendingId] = useState(null);
  const [drawerId, setDrawerId] = useState(null);
  const [drawerEntries, setDrawerEntries] = useState(null);
  const [drawerConfig, setDrawerConfig] = useState(null);

  const handleAction = async (action, id) => {
    setPendingId(id);
    try {
      await postAction(action, id);
      await refresh();
    } finally {
      setPendingId(null);
    }
  };

  const openDetails = (id) => {
    setDrawerId(id);
    setDrawerEntries(null);
    setDrawerConfig(null);
    fetch(`/api/logs/${id}`)
      .then((r) => r.json())
      .then((data) => setDrawerEntries(data.entries || []))
      .catch(() => setDrawerEntries([]));
    fetch(`/api/config/${id}`)
      .then((r) => r.json())
      .then(setDrawerConfig)
      .catch(() => setDrawerConfig({}));
  };

  if (!connected) {
    return (
      <div style={{
        background: PANEL, borderRadius: "10px",
        padding: "44px 20px", textAlign: "center", color: INK_MUTED, fontSize: "15px",
      }}>
        No live data. Is <code style={{ color: INK_SOFT }}>./orchestrate.py serve</code> running?
      </div>
    );
  }

  const entries = Object.entries(liveStatus);
  const drawerProc = drawerId ? liveStatus[drawerId] : null;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {entries.map(([id, proc]) => (
          <ProcessRow
            key={id} id={id} proc={proc}
            pending={pendingId === id}
            onAction={handleAction}
            onDetails={openDetails}
          />
        ))}
      </div>
      <DetailsDrawer
        id={drawerId} proc={drawerProc} entries={drawerEntries} config={drawerConfig}
        onClose={() => setDrawerId(null)} pending={pendingId === drawerId} onAction={handleAction}
      />
    </div>
  );
}

function SystemCard({ sys, liveStatus }) {
  const live = liveStatus[sys.id];
  return (
    <div style={{ background: PANEL, borderRadius: "10px", padding: "22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "26px" }}>{sys.icon}</span>
          <div>
            <div style={{ color: INK, fontWeight: "500", fontSize: "17px" }}>{sys.label}</div>
            <div style={{ color: INK_MUTED, fontSize: "14px" }}>{sys.subtitle}</div>
          </div>
        </div>
        <StatusBadge status={sys.status} liveOverride={live?.status} />
      </div>

      {live?.pid && (
        <div style={{ color: INK_FAINT, fontSize: "13px", marginBottom: "12px" }}>pid {live.pid}</div>
      )}

      <div style={{ marginBottom: "16px" }}>
        <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "8px" }}>CAPABILITIES</div>
        {sys.capabilities.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "6px" }}>
            <span style={{ color: ACCENT, marginTop: "2px", flexShrink: 0 }}>✓</span>
            <span style={{ color: INK_SOFT, fontSize: "14px" }}>{c}</span>
          </div>
        ))}
      </div>

      {sys.gaps?.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "8px" }}>GAPS</div>
          {sys.gaps.map((g, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "6px" }}>
              <span style={{ color: INK_MUTED, marginTop: "2px", flexShrink: 0 }}>▲</span>
              <span style={{ color: INK_SOFT, fontSize: "14px" }}>{g}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: sys.notes ? "12px" : 0 }}>
        {sys.integrations.map((i) => (
          <span key={i} style={{
            background: INSET, color: INK_MUTED,
            fontSize: "12px", padding: "3px 10px", borderRadius: "5px",
          }}>{i}</span>
        ))}
        <span style={{
          background: INSET, color: INK_MUTED,
          fontSize: "12px", padding: "3px 10px", borderRadius: "5px",
        }}>trigger: {sys.trigger}</span>
      </div>

      {sys.notes && (
        <div style={{ background: INSET, borderRadius: "8px", padding: "12px 14px" }}>
          <div style={{ color: INK_MUTED, fontSize: "12px", marginBottom: "4px" }}>NOTES</div>
          <div style={{ color: INK_SOFT, fontSize: "14px", lineHeight: "1.5" }}>{sys.notes}</div>
        </div>
      )}
    </div>
  );
}

function RoadmapTab({ liveStatus }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "42px" }}>
      <section>
        <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "14px" }}>SYSTEMS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "16px" }}>
          {systems.map((s) => (
            <SystemCard key={s.id} sys={s} liveStatus={liveStatus} />
          ))}
        </div>
      </section>

      <section>
        <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "14px" }}>CROSS-CUTTING CONCERNS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {crossCutting.map((item, i) => (
            <div key={i} style={{ background: PANEL, borderRadius: "10px", padding: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "22px" }}>{item.icon}</span>
                <div style={{ color: INK, fontWeight: "500", fontSize: "17px" }}>{item.label}</div>
                <span style={{
                  background: INSET,
                  color: item.maturity === "Built" ? ACCENT : INK_MUTED,
                  fontSize: "12px", padding: "3px 10px", borderRadius: "5px",
                }}>{item.maturity}</span>
              </div>
              <div style={{ color: INK_SOFT, fontSize: "15px", lineHeight: "1.6", marginBottom: "10px" }}>
                {item.description}
              </div>
              <div style={{ background: INSET, borderRadius: "8px", padding: "12px 16px" }}>
                <span style={{ color: INK_MUTED, fontSize: "13px" }}>PATH → </span>
                <span style={{ color: INK_SOFT, fontSize: "14px" }}>{item.path}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "14px" }}>PHASED ROADMAP</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {phaseMap.map((phase, i) => (
            <div key={i} style={{ background: PANEL, borderRadius: "10px", padding: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: INK_FAINT }} />
                <div style={{ color: INK, fontWeight: "500", fontSize: "15px", letterSpacing: "0.1em" }}>
                  {phase.phase.toUpperCase()}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {phase.items.map((item, j) => (
                  <div key={j} style={{
                    display: "flex", gap: "10px", alignItems: "flex-start",
                    background: INSET, borderRadius: "8px", padding: "12px 16px",
                  }}>
                    <span style={{ color: INK_MUTED, flexShrink: 0 }}>→</span>
                    <span style={{ color: INK_SOFT, fontSize: "15px", lineHeight: "1.4" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ background: PANEL, borderRadius: "10px", padding: "22px" }}>
            <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "12px" }}>
              ARCHITECTURE PRINCIPLE
            </div>
            <div style={{ color: INK_SOFT, fontSize: "15px", lineHeight: "1.7" }}>
              Deacon is your <strong style={{ color: INK, fontWeight: "500" }}>heartbeat</strong>. Everything else is orchestrated from it after the wake event, config-driven through <strong style={{ color: INK, fontWeight: "500" }}>config.yaml</strong>.
              Every process writes to a <strong style={{ color: INK, fontWeight: "500" }}>shared audit log</strong> before any destructive automation runs at scale — especially Dropbox at 1TB.
              The Slack/mobile retrieval layer is the <strong style={{ color: INK, fontWeight: "500" }}>payoff</strong>: once your data is organized and indexed, you can pull anything from anywhere.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TriState({ value, trueLabel, falseLabel, unknownLabel = "Unknown" }) {
  const style = value === true
    ? { label: trueLabel, color: ACCENT }
    : value === false
    ? { label: falseLabel, color: INK_MUTED }
    : { label: unknownLabel, color: INK_MUTED };
  return (
    <span style={{
      background: INSET, color: style.color,
      ...PILL, borderRadius: "6px", letterSpacing: "0.02em",
      whiteSpace: "nowrap", display: "inline-block",
    }}>{style.label}</span>
  );
}

function JobRow({ job }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px",
      background: PANEL, borderRadius: "10px", padding: "10px 16px",
    }}>
      <span style={{ fontSize: "18px", flexShrink: 0 }}>{job.kind === "daemon" ? "⚙" : "🧑"}</span>
      <div style={{ width: "230px", flexShrink: 0 }}>
        <div style={{ color: INK, fontWeight: "500", fontSize: "15px" }}>{job.label}</div>
        <span style={{ color: INK_MUTED, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {job.kind === "daemon" ? "LaunchDaemon (root)" : "LaunchAgent (user)"}
        </span>
      </div>
      <div style={{ flex: "1 1 160px", minWidth: 0, color: INK_SOFT, fontSize: "14px" }}>{job.desc}</div>
      {job.pid && <span style={{ color: INK_FAINT, fontSize: "13px", flexShrink: 0 }}>pid {job.pid}</span>}
      <TriState value={job.installed} trueLabel="Installed" falseLabel="Not installed" />
      {job.active !== null && (
        <TriState value={job.active} trueLabel="Active" falseLabel="Inactive" />
      )}
    </div>
  );
}

function WakeRunCard({ title, run, notInstalledHint }) {
  return (
    <div style={{ background: PANEL, borderRadius: "10px", padding: "20px" }}>
      <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "12px" }}>
        {title.toUpperCase()}
      </div>
      {!run && <div style={{ color: INK_MUTED, fontSize: "15px" }}>No log found yet. {notInstalledHint}</div>}
      {run?.error && <div style={{ color: INK_SOFT, fontSize: "15px" }}>{run.error}</div>}
      {run && !run.error && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <TriState value={run.ok} trueLabel="OK" falseLabel="Issue" />
            <span style={{ color: INK_SOFT, fontSize: "14px" }}>{run.timestamp || "unknown time"}</span>
          </div>
          {run.message && (
            <div style={{ color: INK_SOFT, fontSize: "15px", marginBottom: "8px" }}>{run.message}</div>
          )}
          {run.warnings?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {run.warnings.map((w, i) => (
                <div key={i} style={{ color: INK_MUTED, fontSize: "14px" }}>▲ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SystemTab({ systemStatus }) {
  if (!systemStatus) {
    return (
      <div style={{
        background: PANEL, borderRadius: "10px",
        padding: "44px 20px", textAlign: "center", color: INK_MUTED, fontSize: "15px",
      }}>
        No data yet. Is <code style={{ color: INK_SOFT }}>./orchestrate.py serve</code> running?
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <section>
        <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "14px" }}>
          WAKE SCHEDULE (pmset)
        </div>
        <div style={{
          background: PANEL, borderRadius: "10px",
          padding: "18px 20px", color: INK, fontSize: "16px",
        }}>{systemStatus.wake_schedule}</div>
      </section>

      <section>
        <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "14px" }}>
          LAUNCHD JOBS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {systemStatus.jobs.map((job) => <JobRow key={job.label} job={job} />)}
        </div>
      </section>

      <section>
        <div style={{ color: INK_MUTED, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "14px" }}>
          LAST WAKE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
          <WakeRunCard
            title="Wake Scheduler (schedule-wake.sh)"
            run={systemStatus.last_wake_scheduler_run}
            notInstalledHint="Runs at boot + 4:55 AM once com.local.wake-scheduler is installed."
          />
          <WakeRunCard
            title="Post-Wake Routine (post-wake.sh)"
            run={systemStatus.last_post_wake_run}
            notInstalledHint="Runs at 6:00 AM once com.local.post-wake is installed."
          />
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("processes");
  const { liveStatus, connected, refresh } = useLiveStatus();
  const systemStatus = useSystemStatus();

  return (
    <div style={{
      background: PAPER, minHeight: "100vh", color: INK,
      fontFamily: "'Iosevka', monospace", padding: "36px 28px",
      maxWidth: "1100px", margin: "0 auto",
    }}>
      {/* Header + tabs */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "space-between",
        alignItems: "center", gap: "16px", marginBottom: "34px",
      }}>
        <div style={{ fontSize: "30px", fontWeight: "700", letterSpacing: "-0.02em" }}>
          Rise
        </div>

        <div style={{ display: "flex", gap: "4px", background: INSET, borderRadius: "9px", padding: "4px", width: "fit-content" }}>
          {["processes", "system", "roadmap"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? PANEL : "transparent",
              color: tab === t ? INK : INK_MUTED,
              border: "none",
              borderRadius: "7px", padding: "7px 18px", cursor: "pointer",
              fontSize: "14px", letterSpacing: "0.05em",
              textTransform: "uppercase", transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "processes" && <ProcessesTab liveStatus={liveStatus} connected={connected} refresh={refresh} />}
      {tab === "system" && <SystemTab systemStatus={systemStatus} />}
      {tab === "roadmap" && <RoadmapTab liveStatus={liveStatus} />}
    </div>
  );
}
