import { useState, useEffect } from "react";
import { systems, crossCutting, phaseMap } from "./data.js";

// Fetch live process status from orchestrate.py serve (/api/status).
// Falls back gracefully if the API is not running.
function useLiveStatus() {
  const [liveStatus, setLiveStatus] = useState({});

  useEffect(() => {
    const poll = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then(setLiveStatus)
        .catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  return liveStatus;
}

function StatusBadge({ status, liveOverride }) {
  const resolved = liveOverride || status;
  const map = {
    active:       { label: "Active",      bg: "#1a3a1a", color: "#4ade80" },
    "in-progress":{ label: "In Progress", bg: "#2a2a0a", color: "#fbbf24" },
    planned:      { label: "Planned",     bg: "#1a1a3a", color: "#818cf8" },
    running:      { label: "Running",     bg: "#1a3a1a", color: "#4ade80" },
    stopped:      { label: "Stopped",     bg: "#2a1a1a", color: "#f87171" },
  };
  const s = map[resolved] || map.planned;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
      fontSize: "10px", fontFamily: "monospace", padding: "2px 8px",
      borderRadius: "3px", letterSpacing: "0.08em", textTransform: "uppercase",
    }}>{s.label}</span>
  );
}

function SystemCard({ sys, isSelected, onClick, liveStatus }) {
  const live = liveStatus[sys.id];
  return (
    <div onClick={onClick} style={{
      background: isSelected ? `${sys.color}15` : "#0d0d0d",
      border: `1px solid ${isSelected ? sys.color : "#222"}`,
      borderRadius: "8px", padding: "20px", cursor: "pointer",
      transition: "all 0.2s", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: "80px", height: "80px",
        background: `radial-gradient(circle at top right, ${sys.color}20, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>{sys.icon}</span>
          <span style={{ color: "#444", fontFamily: "monospace", fontSize: "11px" }}>{sys.number}</span>
        </div>
        <StatusBadge status={sys.status} liveOverride={live?.status} />
      </div>
      <div style={{ color: "#fff", fontWeight: "600", fontSize: "15px", marginBottom: "2px" }}>{sys.label}</div>
      <div style={{ color: "#555", fontSize: "12px", marginBottom: "12px" }}>{sys.subtitle}</div>
      {live?.pid && (
        <div style={{ color: "#555", fontFamily: "monospace", fontSize: "11px", marginBottom: "8px" }}>
          pid {live.pid}
        </div>
      )}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {sys.integrations.map((i) => (
          <span key={i} style={{
            background: "#111", border: "1px solid #333", color: "#888",
            fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontFamily: "monospace",
          }}>{i}</span>
        ))}
        <span style={{
          background: `${sys.color}20`, border: `1px solid ${sys.color}40`, color: sys.color,
          fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontFamily: "monospace",
        }}>trigger: {sys.trigger}</span>
      </div>
    </div>
  );
}

function DetailPanel({ sys, liveStatus }) {
  const live = liveStatus[sys.id];
  return (
    <div style={{
      background: "#0d0d0d", border: `1px solid ${sys.color}40`,
      borderRadius: "8px", padding: "24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <span style={{ fontSize: "28px" }}>{sys.icon}</span>
        <div>
          <div style={{ color: "#fff", fontSize: "18px", fontWeight: "700" }}>{sys.label}</div>
          <div style={{ color: "#555", fontSize: "13px" }}>{sys.subtitle}</div>
        </div>
      </div>

      {live && (
        <div style={{
          background: "#111", border: "1px solid #222", borderRadius: "6px",
          padding: "10px 14px", marginBottom: "20px",
          display: "flex", gap: "16px", alignItems: "center",
        }}>
          <StatusBadge status={live.status} />
          {live.pid && <span style={{ color: "#555", fontFamily: "monospace", fontSize: "12px" }}>pid {live.pid}</span>}
          {live.log && <span style={{ color: "#444", fontFamily: "monospace", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{live.log}</span>}
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <div style={{ color: sys.color, fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "8px" }}>CAPABILITIES</div>
        {sys.capabilities.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "6px" }}>
            <span style={{ color: sys.accent, marginTop: "2px", flexShrink: 0 }}>✓</span>
            <span style={{ color: "#bbb", fontSize: "13px" }}>{c}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <div style={{ color: "#EA4335", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "8px" }}>GAPS / RISKS</div>
        {sys.gaps.map((g, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "6px" }}>
            <span style={{ color: "#EA4335", marginTop: "2px", flexShrink: 0 }}>▲</span>
            <span style={{ color: "#bbb", fontSize: "13px" }}>{g}</span>
          </div>
        ))}
      </div>

      <div style={{
        background: "#111", border: "1px solid #222", borderRadius: "6px",
        padding: "12px", borderLeft: `3px solid ${sys.color}`,
      }}>
        <div style={{ color: "#666", fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>NOTES</div>
        <div style={{ color: "#aaa", fontSize: "13px", lineHeight: "1.5" }}>{sys.notes}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState(systems[0]);
  const [tab, setTab] = useState("systems");
  const liveStatus = useLiveStatus();

  return (
    <div style={{
      background: "#080808", minHeight: "100vh", color: "#fff",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", padding: "32px 24px",
      maxWidth: "1100px", margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ color: "#444", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.15em", marginBottom: "6px" }}>
          AUTOMATION ARCHITECTURE — ROBIN / ADDITION
        </div>
        <div style={{ fontSize: "26px", fontWeight: "700", letterSpacing: "-0.02em" }}>
          Daily Agent Stack
        </div>
        <div style={{ color: "#555", fontSize: "14px", marginTop: "4px" }}>
          4 systems · 3 gaps · phased roadmap
          {Object.keys(liveStatus).length > 0 && (
            <span style={{ color: "#4ade80", marginLeft: "12px", fontSize: "11px", fontFamily: "monospace" }}>
              ● live
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "#111", borderRadius: "8px", padding: "4px", width: "fit-content" }}>
        {["systems", "cross-cutting", "roadmap"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? "#1e1e1e" : "transparent",
            color: tab === t ? "#fff" : "#555",
            border: tab === t ? "1px solid #333" : "1px solid transparent",
            borderRadius: "6px", padding: "6px 16px", cursor: "pointer",
            fontSize: "12px", fontFamily: "monospace", letterSpacing: "0.05em",
            textTransform: "uppercase", transition: "all 0.15s",
          }}>{t}</button>
        ))}
      </div>

      {tab === "systems" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {systems.map((s) => (
              <SystemCard
                key={s.id}
                sys={s}
                isSelected={selected?.id === s.id}
                onClick={() => setSelected(s)}
                liveStatus={liveStatus}
              />
            ))}
          </div>
          <div>{selected && <DetailPanel sys={selected} liveStatus={liveStatus} />}</div>
        </div>
      )}

      {tab === "cross-cutting" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {crossCutting.map((item, i) => (
            <div key={i} style={{
              background: "#0d0d0d", border: `1px solid ${item.accent}30`,
              borderRadius: "8px", padding: "20px", borderLeft: `3px solid ${item.accent}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div style={{ color: "#fff", fontWeight: "600", fontSize: "15px" }}>{item.label}</div>
                <span style={{
                  background: item.maturity === "Idea" ? "#1a1a3a" : "#2a0a0a",
                  color: item.maturity === "Idea" ? "#818cf8" : "#f87171",
                  border: `1px solid ${item.maturity === "Idea" ? "#818cf840" : "#f8717140"}`,
                  fontSize: "10px", fontFamily: "monospace", padding: "2px 8px", borderRadius: "3px",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>{item.maturity}</span>
              </div>
              <div style={{ color: "#aaa", fontSize: "13px", lineHeight: "1.6", marginBottom: "10px" }}>
                {item.description}
              </div>
              <div style={{ background: "#111", borderRadius: "6px", padding: "10px 14px" }}>
                <span style={{ color: "#555", fontSize: "11px", fontFamily: "monospace" }}>PATH → </span>
                <span style={{ color: "#888", fontSize: "12px" }}>{item.path}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "roadmap" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {phaseMap.map((phase, i) => (
            <div key={i} style={{
              background: "#0d0d0d", border: "1px solid #1a1a1a",
              borderRadius: "8px", padding: "20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <div style={{
                  width: "10px", height: "10px", borderRadius: "50%", background: phase.color,
                  boxShadow: `0 0 8px ${phase.color}80`,
                }} />
                <div style={{ color: phase.color, fontFamily: "monospace", fontWeight: "700", fontSize: "13px", letterSpacing: "0.1em" }}>
                  {phase.phase.toUpperCase()}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {phase.items.map((item, j) => (
                  <div key={j} style={{
                    display: "flex", gap: "10px", alignItems: "flex-start",
                    background: "#111", borderRadius: "6px", padding: "10px 14px",
                  }}>
                    <span style={{ color: phase.color, flexShrink: 0 }}>→</span>
                    <span style={{ color: "#bbb", fontSize: "13px", lineHeight: "1.4" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{
            background: "#0d0d0d", border: "1px solid #222", borderRadius: "8px",
            padding: "20px", borderTop: "3px solid #E94560",
          }}>
            <div style={{ color: "#E94560", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", marginBottom: "12px" }}>
              ARCHITECTURE PRINCIPLE
            </div>
            <div style={{ color: "#aaa", fontSize: "13px", lineHeight: "1.7" }}>
              Deacon is your <strong style={{ color: "#fff" }}>heartbeat</strong>. Everything else should be orchestrated from it after the wake event.
              Build a <strong style={{ color: "#fff" }}>shared audit log</strong> before any destructive automation runs at scale — especially Dropbox at 1TB.
              The Slack/mobile retrieval layer is the <strong style={{ color: "#fff" }}>payoff</strong>: once your data is organized and indexed, you can pull anything from anywhere.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
