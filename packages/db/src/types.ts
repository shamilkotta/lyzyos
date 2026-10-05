import type { InferSelectModel } from "drizzle-orm";
import type { documents, nodeEdges, planningNodes, projects } from "./schema";

export type PlanningNodeKind = "brief" | "doc" | "note" | "question" | "summary" | "answer";

export type AuthorKind = "human" | "agent";

export type ProjectRow = InferSelectModel<typeof projects>;
export type DocumentRow = InferSelectModel<typeof documents>;
export type PlanningNodeRow = InferSelectModel<typeof planningNodes>;
export type NodeEdgeRow = InferSelectModel<typeof nodeEdges>;

export type DocPreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "file";

export type PlanningNodeDto = {
  id: string;
  kind: PlanningNodeKind;
  title: string;
  body: string;
  authorKind: AuthorKind;
  authorName: string;
  status?: string;
  meta?: string;
  /** Linked document id when kind === "doc" */
  docId?: string;
  mime?: string;
  previewKind?: DocPreviewKind;
  x: number;
  y: number;
  createdAt: number;
  updatedAt: number;
};

export type ProjectDto = {
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
  nodes: PlanningNodeDto[];
  edges: { id: string; sourceId: string; targetId: string }[];
  agentStatus: "idle" | "thinking" | "ready" | "error";
  agentMessage?: string;
};

export function previewKindFromMime(mime: string | null | undefined, name = ""): DocPreviewKind {
  const m = (mime ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(n)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/.test(n)) return "audio";
  if (
    m.startsWith("text/") ||
    m.includes("json") ||
    m.includes("markdown") ||
    /\.(txt|md|csv|json|tsv|log)$/.test(n)
  ) {
    return "text";
  }
  return "file";
}

/** Images and PDFs only for project document uploads. */
export function isAllowedProjectDoc(input: { name: string; mime?: string | null }): boolean {
  const kind = previewKindFromMime(input.mime, input.name);
  return kind === "image" || kind === "pdf";
}

export function rowToNode(
  row: PlanningNodeRow,
  doc?: Pick<DocumentRow, "id" | "mime" | "name"> | null,
): PlanningNodeDto {
  const docId = row.kind === "doc" ? (doc?.id ?? row.meta ?? undefined) : undefined;
  const mime = doc?.mime ?? undefined;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    authorKind: row.authorKind,
    authorName: row.authorName,
    status: row.status ?? undefined,
    meta: row.meta ?? undefined,
    docId,
    mime,
    previewKind: row.kind === "doc" ? previewKindFromMime(mime, doc?.name ?? row.title) : undefined,
    x: row.x,
    y: row.y,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToProject(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    brief: row.brief,
    ownerId: row.ownerId,
    threadId: row.threadId,
    planningStatus: row.planningStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
