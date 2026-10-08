export type StatusTone = "neutral" | "ok" | "warn" | "danger" | "info";

export const workStatuses = [
  "not_started",
  "in_progress",
  "blocked",
  "in_review",
  "complete",
  "ready",
] as const;
export type WorkStatus = (typeof workStatuses)[number];

export type MemberKind = "human" | "agent";

export const departmentIds = [
  "intake",
  "planning",
  "research",
  "strategy",
  "creative",
  "brand",
  "compliance",
  "localization",
  "approvals",
  "launch",
] as const;
export type DepartmentId = (typeof departmentIds)[number];

export type Member = {
  id: string;
  name: string;
  role: string;
  kind: MemberKind;
  initials: string;
  status: "online" | "working" | "away";
  departmentIds: DepartmentId[];
  image?: string | null;
};

export type Department = {
  id: DepartmentId;
  name: string;
  summary: string;
  status: WorkStatus;
  tone: StatusTone;
  memberIds: string[];
  dependsOn: DepartmentId[];
  branches?: { id: string; name: string; status: WorkStatus; tone: StatusTone }[];
  attention?: string;
};

export const branchItemKinds = [
  "work",
  "asset",
  "comment",
  "note",
  "blocker",
  "instruction",
] as const;
export type BranchItemKind = (typeof branchItemKinds)[number];

export type BranchItem = {
  id: string;
  kind: BranchItemKind;
  title: string;
  body?: string;
  tone?: StatusTone;
  authorId?: string;
  meta?: string;
  x: number;
  y: number;
};

export type AttentionItem = {
  id: string;
  campaignId: string;
  campaignName: string;
  departmentId: DepartmentId;
  title: string;
  reason: string;
  tone: StatusTone;
  kind: "review" | "blocker" | "decision";
};

export type CampaignSpace = {
  id: string;
  name: string;
  client: string;
  launchDate: string;
  stage: string;
  attention: number;
  blockers: number;
  status: WorkStatus;
};

export type InspectorSelection =
  | { type: "none" }
  | {
      type: "department";
      id: DepartmentId;
      title: string;
      subtitle?: string;
    }
  | {
      type: "item";
      id: string;
      kind: BranchItemKind;
      title: string;
      subtitle?: string;
      departmentId: DepartmentId;
    }
  | {
      type: "workspace";
      id: string;
      name: string;
      summary: string;
      status: WorkStatus;
      members: Member[];
    }
  | { type: "member"; member: Member; activeIn?: string[] }
  | { type: "attention"; item: AttentionItem };

export function isDepartmentId(value: string): value is DepartmentId {
  return (departmentIds as readonly string[]).includes(value);
}

export function isBranchItemKind(value: string): value is BranchItemKind {
  return (branchItemKinds as readonly string[]).includes(value);
}
