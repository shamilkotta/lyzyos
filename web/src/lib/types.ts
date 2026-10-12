import type { ProjectDto, WorkspaceDto } from "@lyzyos/db";

export type StatusTone = "neutral" | "ok" | "warn" | "danger" | "info";

export type WorkStatus = NonNullable<WorkspaceDto["status"]>;
export type ProjectStatus = ProjectDto["status"];

export type MemberKind = "human" | "agent";

/** A person or agent as rendered in avatars, presence stacks and rosters. */
export type Member = {
  id: string;
  name: string;
  role: string;
  kind: MemberKind;
  initials: string;
  status: "online" | "working" | "away";
  image?: string | null;
};
