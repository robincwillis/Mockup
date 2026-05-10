export const systems = [
  {
    id: "gws",
    number: "01",
    label: "GWS / ADK Agent",
    subtitle: "Gemini + Google Workspace",
    status: "active",
    color: "#4285F4",
    accent: "#34A853",
    icon: "✉",
    capabilities: [
      "Gmail labeling, archiving, delete",
      "Drive folder management",
      "Specific prompt library per task",
    ],
    gaps: [
      "No scheduling / cron trigger yet",
      "No cross-system awareness",
      "Prompts not versioned or tested",
    ],
    integrations: ["Gmail", "Drive"],
    trigger: "Manual",
    notes:
      "Solid foundation. Needs a scheduler + prompt management layer to be truly autonomous. Deacon should trigger this after wake.",
  },
  {
    id: "deacon",
    number: "02",
    label: "Deacon",
    subtitle: "Daily Wake + Orchestration",
    status: "active",
    color: "#FF6B35",
    accent: "#FFB347",
    icon: "⏰",
    capabilities: [
      "Wake from sleep at 7:00 AM via pmset",
      "Caffeinate (prevent idle sleep)",
      "Orchestrate downstream agents at 7:05 AM",
    ],
    gaps: [
      "Conditional only — requires laptop to be open",
      "GWS, Dropbox, bookmark agents not yet wired in",
      "No daily digest / status email yet",
    ],
    integrations: ["macOS"],
    trigger: "Cron 7:00 AM",
    notes:
      "This is your orchestration heartbeat. Everything else should fire from here after wake — GWS pass, Dropbox window, bookmark sync.",
  },
  {
    id: "dropbox",
    number: "03",
    label: "Dropbox Organizer",
    subtitle: "Claude Code + Custom MCP",
    status: "in-progress",
    color: "#0061FF",
    accent: "#00AEEF",
    icon: "📁",
    capabilities: [
      "Move & delete files via custom MCP tools",
      "Organization principles versioned as skills",
      "Loop-based continuous run",
    ],
    gaps: [
      "~1TB needs prioritization strategy before write mode",
      "No dry-run / manifest-first review mode",
      "Risk of destructive ops at scale without audit log",
    ],
    integrations: ["Dropbox"],
    trigger: "Loop (time-boxed)",
    notes:
      "Needs a phased approach: audit pass first (read-only, produce manifest), then human review, then write mode. Start with highest-priority folders.",
  },
  {
    id: "bookmarks",
    number: "04",
    label: "Bookmark Knowledge Base",
    subtitle: "Agent-Searchable RAG",
    status: "planned",
    color: "#7B2FBE",
    accent: "#C77DFF",
    icon: "🔖",
    capabilities: [
      "1000+ bookmarks to ingest",
      "Claude enrichment: title, summary, tags per URL",
      "Agent-searchable via Pinecone / vector DB",
    ],
    gaps: [
      "No ingestion pipeline yet",
      "No sync mechanism for new bookmarks",
      "Metadata enrichment (summaries, tags) not built",
    ],
    integrations: ["Browser", "Pinecone"],
    trigger: "Batch + Sync",
    notes:
      "Classic RAG problem. Export bookmarks → enrich with Claude → embed → Pinecone. Sync via browser extension or scheduled export diff.",
  },
];

export const crossCutting = [
  {
    label: "Slack / Mobile Retrieval",
    icon: "💬",
    color: "#611f69",
    accent: "#E01E5A",
    description:
      "Surface media and files from Dropbox, Gmail, Drive via Slack commands or Claude mobile. Find + retrieve without leaving your phone.",
    maturity: "Idea",
    path:
      "Slack bot or Claude mobile with MCP connectors for Dropbox + Drive + Gmail. Natural language queries → file links or previews.",
  },
  {
    label: "Orchestration Layer",
    icon: "🔄",
    color: "#1a1a2e",
    accent: "#E94560",
    description:
      "Deacon wakes the laptop — but nothing coordinates the downstream agents afterward. Need a lightweight conductor.",
    maturity: "Gap",
    path:
      "Deacon triggers orchestrate.py start: GWS agent runs, Dropbox organizer runs N minutes, bookmark sync checks. All write to shared audit log.",
  },
  {
    label: "Audit + Observability",
    icon: "📊",
    color: "#003049",
    accent: "#FCBF49",
    description:
      "Destructive operations across Dropbox (1TB) and email need audit trails. What was moved/deleted and when?",
    maturity: "Gap",
    path:
      "Append-only audit.log + per-process daily logs already in place via Deacon. Each agent writes a structured entry. Add a daily digest email.",
  },
];

export const phaseMap = [
  {
    phase: "Now",
    color: "#34A853",
    items: [
      "Deacon → trigger GWS + Dropbox + bookmark agents after wake",
      "Dropbox audit pass (read-only, produce manifest — no deletes)",
      "GWS agent on a schedule via Deacon",
    ],
  },
  {
    phase: "Soon",
    color: "#FBBC05",
    items: [
      "Bookmark export + Claude enrichment pipeline → Pinecone",
      "Dropbox organizer in phased write mode (folder by folder)",
      "Daily digest email summarising what each agent did",
    ],
  },
  {
    phase: "Later",
    color: "#EA4335",
    items: [
      "Slack / mobile retrieval layer (MCP connectors for all three)",
      "Unified natural-language search across Dropbox + Drive + bookmarks",
      "Cross-agent state sharing (agents aware of each other's output)",
    ],
  },
];
