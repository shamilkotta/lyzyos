export type StatusTone = "neutral" | "ok" | "warn" | "danger" | "info";

export type WorkStatus =
  | "draft"
  | "in_progress"
  | "complete"
  | "changes_requested"
  | "blocked"
  | "ready"
  | "not_started"
  | "in_review"
  | "approved";

export type NodeKind =
  | "brief"
  | "stage"
  | "asset"
  | "agent"
  | "comment"
  | "blocker"
  | "note"
  | "market"
  | "launch";

export type CampaignSpace = {
  id: string;
  name: string;
  client: string;
  launchDate: string;
  progress: number;
  stage: string;
  attention: number;
  blockers: number;
  status: WorkStatus;
};

export type AgentPresence = {
  id: string;
  name: string;
  role: string;
  status: "idle" | "working" | "waiting";
  lastAction: string;
  time: string;
};

export type AttentionItem = {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string;
  reason: string;
  tone: StatusTone;
  kind: "review" | "blocker" | "decision";
};

export type InspectorSelection =
  | { type: "none" }
  | { type: "node"; id: string; kind: NodeKind; title: string; subtitle?: string }
  | { type: "attention"; item: AttentionItem };
