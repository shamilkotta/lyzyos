export type StatusTone = "neutral" | "ok" | "warn" | "danger" | "info";

export type WorkStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "complete"
  | "ready";

export type MemberKind = "human" | "agent";

export type Member = {
  id: string;
  name: string;
  role: string;
  kind: MemberKind;
  initials: string;
  status: "online" | "working" | "away";
  departmentIds: DepartmentId[];
};

export type DepartmentId =
  | "intake"
  | "planning"
  | "research"
  | "strategy"
  | "creative"
  | "brand"
  | "compliance"
  | "localization"
  | "approvals"
  | "launch";

export type Department = {
  id: DepartmentId;
  name: string;
  summary: string;
  status: WorkStatus;
  tone: StatusTone;
  memberIds: string[];
  /** Parent departments this waits on */
  dependsOn: DepartmentId[];
  /** Optional parallel lanes under this department */
  branches?: { id: string; name: string; status: WorkStatus; tone: StatusTone }[];
  attention?: string;
};

export type BranchItemKind = "work" | "asset" | "comment" | "note" | "blocker" | "instruction";

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
  | { type: "member"; member: Member }
  | { type: "attention"; item: AttentionItem };
