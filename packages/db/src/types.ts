import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";
import type {
  comments,
  documents,
  nodeEdges,
  nodes,
  notes,
  projects,
  workspaces,
} from "./project.schema";
import { nodeKinds, status } from "./project.schema";
import {
  authorKindSchema,
  commentOpenAudienceSchema,
  commentReplySchema,
  commentStatusSchema,
  type AuthorKind,
  type CommentOpenAudience,
  type CommentReply,
  type CommentStatus,
} from "./comments";
import { resolveAuthorKind } from "./constants";

export type { AuthorKind, CommentOpenAudience, CommentReply, CommentStatus };
export type NodeKind = (typeof nodeKinds)[number];
export type Status = (typeof status)[number];

export type ProjectRow = InferSelectModel<typeof projects>;
export type WorkspaceRow = InferSelectModel<typeof workspaces>;
export type DocumentRow = InferSelectModel<typeof documents>;
export type NodeRow = InferSelectModel<typeof nodes>;
export type NodeEdgeRow = InferSelectModel<typeof nodeEdges>;

export const docPreviewKinds = ["image", "pdf", "video", "audio", "text", "file"] as const;
export const docPreviewKindSchema = z.enum(docPreviewKinds);
export type DocPreviewKind = z.infer<typeof docPreviewKindSchema>;

export const nodeAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
});
export type NodeAuthor = z.infer<typeof nodeAuthorSchema>;

const nodeBaseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  authorId: z.string(),
  authorKind: authorKindSchema,
  authorName: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const noteNodeSchema = nodeBaseSchema.extend({
  kind: z.literal("note"),
  body: z.string(),
});

export const commentNodeSchema = nodeBaseSchema.extend({
  kind: z.literal("comment"),
  body: z.string(),
  replies: z.array(commentReplySchema),
  openAudience: commentOpenAudienceSchema.nullable().optional(),
  status: commentStatusSchema.nullable().optional(),
});

export const docNodeSchema = nodeBaseSchema.extend({
  kind: z.literal("doc"),
  body: z.string(),
  docId: z.string(),
  mime: z.string(),
  previewKind: docPreviewKindSchema,
});

export const nodeDtoSchema = z.discriminatedUnion("kind", [
  noteNodeSchema,
  commentNodeSchema,
  docNodeSchema,
]);
export type NodeDto = z.infer<typeof nodeDtoSchema>;
export type NoteNodeDto = z.infer<typeof noteNodeSchema>;
export type CommentNodeDto = z.infer<typeof commentNodeSchema>;
export type DocNodeDto = z.infer<typeof docNodeSchema>;

export const projectDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  status: z.enum(status),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ProjectDto = z.infer<typeof projectDtoSchema>;

export const workspaceDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  slug: z.string(),
  name: z.string(),
  kind: z.string(),
  status: z.enum(status).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type WorkspaceDto = z.infer<typeof workspaceDtoSchema>;

export const boardEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
});
export type BoardEdge = z.infer<typeof boardEdgeSchema>;

export const memberPreviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
});
export type MemberPreview = z.infer<typeof memberPreviewSchema>;

export type WorkspaceForBoard = Pick<
  WorkspaceRow,
  "id" | "projectId" | "slug" | "name" | "kind" | "createdAt" | "updatedAt"
> & {
  status?: WorkspaceRow["status"];
  project: ProjectRow;
};

export type NodeCommentRel = InferSelectModel<typeof comments> & {
  user: NodeAuthor;
};

export type NodeNoteRel = InferSelectModel<typeof notes>;

export type NodeDocumentRel = InferSelectModel<typeof documents>;

/** Node row with author + kind payloads loaded. Required input for `rowToNode`. */
export type NodeWithRelations = NodeRow & {
  author: NodeAuthor;
  comments: NodeCommentRel[];
  notes: NodeNoteRel[];
  documents: NodeDocumentRel[];
};

export function isNoteNode(node: NodeDto): node is NoteNodeDto {
  return node.kind === "note";
}

export function isCommentNode(node: NodeDto): node is CommentNodeDto {
  return node.kind === "comment";
}

export function isDocNode(node: NodeDto): node is DocNodeDto {
  return node.kind === "doc";
}

export function isNodeKind(value: unknown): value is NodeKind {
  return typeof value === "string" && (nodeKinds as readonly string[]).includes(value);
}

export function isNodeRowOfKind<K extends NodeKind>(
  row: Pick<NodeRow, "kind">,
  kind: K,
): row is Pick<NodeRow, "kind"> & { kind: K } {
  return row.kind === kind;
}

export function isDocPreviewKind(value: unknown): value is DocPreviewKind {
  return docPreviewKindSchema.safeParse(value).success;
}

export function isTextLikeFile(mime: string, name: string) {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  return (
    m.startsWith("text/") ||
    m.includes("json") ||
    m.includes("markdown") ||
    /\.(txt|md|csv|json|tsv|log)$/.test(n)
  );
}

export function previewKindFromMime(mime: string | null | undefined, name = "") {
  const m = (mime ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(n)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/.test(n)) return "audio";
  if (isTextLikeFile(m, n)) return "text";
  return "file";
}

function nodeBase(row: NodeWithRelations, agentId: string) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    authorId: row.authorId,
    authorKind: resolveAuthorKind({ id: row.authorId, agentId }),
    authorName: row.author.name,
    x: row.x,
    y: row.y,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } satisfies Omit<NoteNodeDto, "kind" | "body">;
}

function commentStatusFromRow(status: string | null) {
  return commentStatusSchema.safeParse(status).data ?? null;
}

export function rowToNode(row: NodeWithRelations, agentId: string) {
  const base = nodeBase(row, agentId);

  switch (row.kind) {
    case "comment": {
      const comments = [...row.comments].sort((a, b) => a.createdAt - b.createdAt);
      const [root, ...rest] = comments;
      return {
        ...base,
        kind: "comment",
        body: root?.data ?? "",
        replies: rest.map((c) => ({
          id: c.id,
          authorKind: resolveAuthorKind({ id: c.userId, agentId }),
          authorName: c.user.name,
          body: c.data,
          createdAt: c.createdAt,
        })),
        openAudience: null,
        status: commentStatusFromRow(row.status),
      } satisfies CommentNodeDto;
    }
    case "note": {
      const note = row.notes[0];
      return {
        ...base,
        kind: "note",
        body: note?.data ?? "",
      } satisfies NoteNodeDto;
    }
    case "doc": {
      const doc = row.documents[0];
      return {
        ...base,
        kind: "doc",
        body: doc?.name ?? "",
        docId: doc?.id ?? "",
        mime: doc?.mime ?? "",
        previewKind: previewKindFromMime(doc?.mime, doc?.name ?? row.title),
      } satisfies DocNodeDto;
    }
    default: {
      const _exhaustive: never = row.kind;
      return _exhaustive;
    }
  }
}

export function rowToProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToWorkspace(
  row: Pick<WorkspaceRow, "id" | "projectId" | "slug" | "name" | "kind" | "createdAt" | "updatedAt"> & {
    status?: WorkspaceRow["status"];
  },
) {
  return {
    id: row.id,
    projectId: row.projectId,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToEdge(row: Pick<NodeEdgeRow, "id" | "sourceId" | "targetId">) {
  return {
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
  };
}
