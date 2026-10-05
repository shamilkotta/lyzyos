export type PlanningNodeKind = "brief" | "doc" | "note" | "question" | "summary" | "answer";

export type DocPreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "file";

export type PlanningNode = {
  id: string;
  kind: PlanningNodeKind;
  title: string;
  body: string;
  authorKind: "human" | "agent";
  authorName: string;
  status?: string;
  meta?: string;
  docId?: string;
  mime?: string;
  previewKind?: DocPreviewKind;
  x: number;
  y: number;
  createdAt: number;
  updatedAt: number;
};

export type Project = {
  id: string;
  name: string;
  brief: string;
  ownerId: string;
  threadId: string | null;
  planningStatus: "in_progress" | "complete";
  createdAt: number;
  updatedAt: number;
};

export type BoardState = {
  projectId: string;
  projectName: string;
  planningStatus: "in_progress" | "complete";
  threadId: string | null;
  nodes: PlanningNode[];
  edges: { id: string; sourceId: string; targetId: string }[];
  agentStatus: "idle" | "thinking" | "ready" | "error";
  agentMessage?: string;
};

export type ApiProjectListItem = Project;

export function documentFileUrl(projectId: string, docId: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return `${base}/api/projects/${projectId}/documents/${docId}/file`;
}
