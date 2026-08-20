export const systems = [
  {
    id: "gws",
    number: "01",
    label: "Google Workspace Agents",
    subtitle: "ADK + gws CLI — ../google-workspace-agents",
    status: "active",
    icon: "✉",
    capabilities: [
      "4 agents: Drive Architect, Inbox Gardener, Storage Sentinel, Auction Intelligence",
      "Each a single-step `uv run adk run` query — runs once and exits",
      "gws-api-server + gws-slack-gateway run continuously — ask the agents from Slack on your phone",
      "Scheduled and tracked through orchestrate.py (scripts/gws-query.sh)",
    ],
    gaps: [
      "Storage Sentinel and Auction Intelligence still disabled pending a reviewed run",
      "OAuth tokens expire after ~7 days in test mode; needs periodic `gws auth login`",
      "Slack gateway only reaches the GWS agents — not Dropbox or Bookhound yet",
    ],
    integrations: ["Gmail", "Drive", "Slack"],
    trigger: "orchestrate.py (script)",
    notes:
      "Wrapper script (scripts/gws-query.sh) is shared across all 4 one-shot agents — the prompt in config.yaml is the only thing that differs between them.",
  },
  {
    id: "dropbox",
    number: "02",
    label: "Dropbox Organizer",
    subtitle: "Claude Code plugin — ../dropbox-plugin",
    status: "active",
    icon: "📁",
    capabilities: [
      "audit-dropbox and process-sort-inbox skills, versioned in the plugin repo",
      "Two-phase config: audit (read-only manifest) enabled, organize disabled until reviewed",
      "/G&W and /Camera Uploads hard-coded off-limits in every prompt",
    ],
    gaps: [
      "organize phase still disabled — enable only after reviewing audit-output.md",
      "~1TB still needs a folder-priority pass before write mode runs at scale",
      "MCP tool calls (list_files, etc.) aren't in --allowedTools, so an unattended run can hang waiting on a permission prompt",
    ],
    integrations: ["Dropbox"],
    trigger: "orchestrate.py (claude -p)",
    notes:
      "Audit-first, phased rollout: read-only manifest → human review → folder-by-folder write mode, matching the taxonomy in dropbox-org-progress.md.",
  },
  {
    id: "bookhound",
    number: "03",
    label: "Bookhound",
    subtitle: "Bookmark search — ../bookhound",
    status: "active",
    icon: "🔖",
    capabilities: [
      "Semantic search over bookmarks via Pinecone + Voyage embeddings",
      "Claude-generated summary + tags per bookmark at ingest time",
      "bookhound-sync pulls live from Chrome + Safari — safe to re-run, deduped by sha256(url)",
      "bookhound-morning-search surfaces something random/forgotten via its MCP server",
    ],
    gaps: [
      "No dead-link pruning yet — bookhound's own roadmap has a bulk HEAD-check sweep planned",
      "Morning search is scoped to search_bookmarks only via --allowedTools, by design",
    ],
    integrations: ["Chrome", "Safari", "Pinecone"],
    trigger: "orchestrate.py (script + claude -p)",
    notes:
      "The MCP permission-hang problem was caught and fixed here first (--allowedTools=mcp__bookhound__search_bookmarks) — dropbox-audit has the same issue, unresolved.",
  },
  {
    id: "deacon",
    number: "04",
    label: "Deacon / Rise",
    subtitle: "Wake automation + dashboard — this repo",
    status: "active",
    icon: "⏰",
    capabilities: [
      "pmset wake alarm, re-applied at boot and daily in case OS updates clear it",
      "Timed caffeinate (3h) asserted by post-wake.sh at wake time — no persistent caffeinate agent anymore",
      "orchestrate.py: config-driven start/stop/enable/status/logs for every process above",
      "Rise dashboard: live status, start/stop/enable controls, per-process log drawer",
      "com.user.dashboard serves the dashboard continuously on 0.0.0.0 — reachable from your phone",
    ],
    gaps: [
      "Wake itself is conditional — still requires the laptop to be open",
      "No daily digest email summarizing what every agent did overnight",
      "Dashboard's mutation endpoints (start/stop/enable) have no authentication — fine on a trusted LAN only",
    ],
    integrations: ["macOS", "launchd"],
    trigger: "5:00 AM wake, 6:00 AM orchestrator + continuous",
    notes:
      "Two separate LaunchAgents by design: com.user.orchestrator fires once daily (start), com.user.dashboard runs continuously (serve) — a one-shot job and a persistent server don't share a launchd lifecycle cleanly.",
  },
];

export const crossCutting = [
  {
    label: "Slack / Mobile Retrieval",
    icon: "💬",
    description:
      "Ask the GWS agents from Slack on your phone, and view/control the whole dashboard from your phone too. Extending Slack access to Dropbox + Bookhound is the remaining piece.",
    maturity: "In Progress",
    path:
      "Built: gws-slack-gateway + gws-api-server (Slack → GWS agents), com.user.dashboard on 0.0.0.0 (phone → Rise). Missing: Dropbox/Bookhound aren't reachable from Slack yet.",
  },
  {
    label: "Orchestration Layer",
    icon: "🔄",
    description:
      "Deacon wakes the laptop, and orchestrate.py coordinates every downstream agent from one config.yaml.",
    maturity: "Built",
    path:
      "config.yaml defines every process (gws-*, dropbox-*, bookhound-*, smoke tests); orchestrate.py start/stop/enable/status/logs/serve manages them, with PID tracking and per-process logs.",
  },
  {
    label: "Audit + Observability",
    icon: "📊",
    description:
      "Destructive operations across Dropbox (1TB) and email need audit trails. What was moved/deleted and when?",
    maturity: "In Progress",
    path:
      "logs/audit.log (append-only, every start/stop/error) plus per-process daily logs, viewable as collapsible entries right in the dashboard (ANSI codes and spinner noise stripped). Still missing: a daily digest email.",
  },
];

export const phaseMap = [
  {
    phase: "Now",
    color: "#34A853",
    items: [
      "Fix dropbox-audit's MCP permissions (--allowedTools) so it stops hanging on unattended runs — same fix already applied to bookhound-morning-search",
      "Review a Storage Sentinel / Auction Intelligence run, then enable the ones that look good",
      "Review dropbox-audit's manifest, then enable dropbox-organize",
    ],
  },
  {
    phase: "Soon",
    color: "#b45309",
    items: [
      "bookhound's dead-link pruning sweep (scripts/prune_dead.py)",
      "Dropbox organizer in phased write mode (folder by folder)",
      "Daily digest email summarizing what every agent did overnight",
    ],
  },
  {
    phase: "Later",
    color: "#EA4335",
    items: [
      "Extend the Slack gateway to reach Dropbox + Bookhound, not just GWS",
      "Unified natural-language search across Dropbox + Drive + bookmarks",
      "Cross-agent state sharing (agents aware of each other's output)",
    ],
  },
];
