import type { AttentionItem, AgentPresence, CampaignSpace } from "./types";

export const PRODUCT_NAME = "Workbench";

export const spaces: CampaignSpace[] = [
  {
    id: "secureedge",
    name: "SecureEdge Enterprise Launch",
    client: "Northwind Security",
    launchDate: "Nov 10",
    progress: 82,
    stage: "Localization",
    attention: 2,
    blockers: 2,
    status: "blocked",
  },
  {
    id: "nova",
    name: "Nova AI Product Narrative",
    client: "Nova Labs",
    launchDate: "Nov 18",
    progress: 64,
    stage: "Creative",
    attention: 1,
    blockers: 0,
    status: "in_progress",
  },
  {
    id: "atlas",
    name: "Atlas Platform Refresh",
    client: "Atlas Cloud",
    launchDate: "Nov 7",
    progress: 100,
    stage: "Launch",
    attention: 0,
    blockers: 0,
    status: "ready",
  },
];

export const attentionQueue: AttentionItem[] = [
  {
    id: "att-1",
    campaignId: "secureedge",
    campaignName: "SecureEdge",
    title: "Legal review pending",
    reason: "Unsupported claim on LinkedIn Ad #3",
    tone: "danger",
    kind: "review",
  },
  {
    id: "att-2",
    campaignId: "secureedge",
    campaignName: "SecureEdge",
    title: "Germany localization blocked",
    reason: "Market disclaimer missing",
    tone: "warn",
    kind: "blocker",
  },
  {
    id: "att-3",
    campaignId: "nova",
    campaignName: "Nova AI",
    title: "Messaging direction",
    reason: "Strategist decision on ICP wording",
    tone: "info",
    kind: "decision",
  },
];

export const agents: AgentPresence[] = [
  {
    id: "agent-campaign",
    name: "Campaign Manager",
    role: "Orchestration",
    status: "waiting",
    lastAction: "Waiting on legal decision",
    time: "2m ago",
  },
  {
    id: "agent-creative",
    name: "Creative Agent",
    role: "Production",
    status: "idle",
    lastAction: "Generated 24 assets",
    time: "48m ago",
  },
  {
    id: "agent-brand",
    name: "Brand Guardian",
    role: "QA",
    status: "idle",
    lastAction: "Checked 87 brand rules",
    time: "46m ago",
  },
  {
    id: "agent-compliance",
    name: "Compliance Agent",
    role: "QA",
    status: "working",
    lastAction: "Flagged unsupported claim",
    time: "now",
  },
  {
    id: "agent-l10n",
    name: "Localization Agent",
    role: "Markets",
    status: "waiting",
    lastAction: "Needs Germany disclaimer",
    time: "12m ago",
  },
];

export const activityFeed = [
  {
    time: "10:53",
    agent: "Compliance Agent",
    text: "Germany disclaimer missing",
    tone: "warn" as const,
  },
  {
    time: "10:51",
    agent: "Localization Agent",
    text: "Created German variants",
    tone: "ok" as const,
  },
  {
    time: "10:49",
    agent: "Creative Agent",
    text: "Fixed 2 brand issues",
    tone: "ok" as const,
  },
  {
    time: "10:48",
    agent: "Compliance Agent",
    text: "Found 3 claim issues",
    tone: "warn" as const,
  },
  {
    time: "10:46",
    agent: "Brand Guardian",
    text: "Checked 87 brand rules",
    tone: "ok" as const,
  },
  {
    time: "10:44",
    agent: "Creative Agent",
    text: "Generated 24 assets",
    tone: "ok" as const,
  },
  {
    time: "10:42",
    agent: "Campaign Manager",
    text: "Created campaign plan",
    tone: "ok" as const,
  },
];

export const issueDetail = {
  title: "Unsupported claim",
  severity: "High risk",
  quote: "Eliminates 100% of security threats.",
  why: "This claim does not exist in the approved claims library.",
  suggestion: "Helps organizations detect and respond to security threats faster.",
  source: "Approved Claims v2.1",
};

export const stageChecklist = [
  { label: "Strategy", state: "complete" as const },
  { label: "Creative", state: "complete" as const },
  { label: "QA", state: "complete" as const },
  { label: "Localization", state: "warn" as const },
  { label: "Approvals", state: "warn" as const },
  { label: "Launch", state: "idle" as const },
];
