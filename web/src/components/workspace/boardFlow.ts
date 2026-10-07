import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { BoardNodeData, WorkspaceCardData } from "@/components/canvas/nodes/CanvasNodes";
import type { Member } from "@/lib/types";
import { documentFileUrl, isCommentNode, type BoardNode } from "@/lib/project-types";
import { resolveAuthorKind, type CommentOpenAudience } from "@lyzyos/db";

export function boardKindLabel(kind: BoardNode["kind"]) {
  switch (kind) {
    case "doc":
      return "Document";
    case "note":
      return "Note";
    case "comment":
      return "Comment";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function iconFor(kind: BoardNode["kind"]): WorkspaceCardData["icon"] {
  switch (kind) {
    case "doc":
      return "doc";
    case "comment":
      return "comment";
    case "note":
      return "note";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function typeLabelFor(node: BoardNode) {
  return boardKindLabel(node.kind);
}

function normalizeHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function handlesMatch(a: string, b: string) {
  const left = normalizeHandle(a);
  const right = normalizeHandle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.split(" ")[0] === right.split(" ")[0];
}

function viewerSeesOpen(audience: CommentOpenAudience | null | undefined, viewerName: string) {
  if (!audience) return false;
  if (audience.kind === "everyone") return true;
  return audience.names.some((name) => handlesMatch(name, viewerName));
}

function actionFor(node: BoardNode, viewerName: string): WorkspaceCardData["action"] | undefined {
  if (!isCommentNode(node)) return undefined;
  if (node.status === "resolved") {
    return { tone: "ok", variant: "resolved" };
  }
  if (node.status === "open" && viewerSeesOpen(node.openAudience, viewerName)) {
    return { tone: "warn", variant: "needs_reply" };
  }
  return undefined;
}

function titleFor(node: BoardNode) {
  switch (node.kind) {
    case "doc":
      return node.title.trim();
    case "comment":
      return "";
    case "note": {
      const title = node.title.trim();
      if (!title || title === "Untitled note" || title === "Note") {
        return boardKindLabel(node.kind);
      }
      return title;
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function clip(body: string) {
  return body.length > 140 ? `${body.slice(0, 140)}…` : body;
}

function summaryFor(node: BoardNode) {
  if (node.kind === "doc") return "";
  if (isCommentNode(node)) {
    const latest = node.replies.at(-1)?.body.trim() ?? "";
    const body = (latest || node.body).trim();
    if (body.length === 0) return "No message yet — open to edit.";
    return clip(body);
  }
  const body = node.body.trim();
  if (body.length === 0) return "No content yet — open to edit.";
  return clip(body);
}

export function memberFromAuthor(
  authorKind: BoardNode["authorKind"],
  authorName: string,
  opts?: { id?: string; image?: string | null; status?: Member["status"] },
) {
  const initials =
    authorName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "YO";

  return {
    id: opts?.id ?? `${authorKind}:${authorName.trim().toLowerCase()}`,
    name: authorName,
    role: "Collaborator",
    kind: authorKind,
    initials,
    status: opts?.status ?? "online",
    departmentIds: [],
    image: opts?.image ?? null,
  } satisfies Member;
}

export function membersFromWorkspace(
  authors: Array<{ id: string; name: string; image?: string | null }>,
  onlineNames: Set<string> = new Set(),
  agentId: string,
) {
  const byId = new Map<string, Member>();
  for (const author of authors) {
    if (!author.id || byId.has(author.id)) continue;
    const kind = resolveAuthorKind({ id: author.id, agentId });
    const online =
      onlineNames.has(author.name) || [...onlineNames].some((n) => handlesMatch(n, author.name));
    byId.set(
      author.id,
      memberFromAuthor(kind, author.name, {
        id: author.id,
        image: author.image,
        status: online ? "online" : "away",
      }),
    );
  }
  return [...byId.values()];
}

export function membersFor(node: BoardNode) {
  const byId = new Map<string, Member>();
  const add = (kind: BoardNode["authorKind"], name: string) => {
    if (!name.trim()) return;
    const member = memberFromAuthor(kind, name);
    if (!byId.has(member.id)) byId.set(member.id, member);
  };

  add(node.authorKind, node.authorName);
  if (isCommentNode(node)) {
    for (const reply of node.replies) {
      add(reply.authorKind, reply.authorName);
    }
  }
  return [...byId.values()];
}

function attentionFor(node: BoardNode, viewerName: string) {
  if (!isCommentNode(node)) return undefined;
  if (node.status !== "open") return undefined;
  if (!viewerSeesOpen(node.openAudience, viewerName)) return undefined;
  return "Reply needed";
}

function previewFor(projectId: string, node: BoardNode): WorkspaceCardData["preview"] | undefined {
  if (node.kind !== "doc") return undefined;
  const kind = node.previewKind;
  const url = node.docId ? documentFileUrl(projectId, node.docId) : undefined;
  const text =
    kind === "text" && node.body.trim().length > 0 ? node.body.trim().slice(0, 280) : undefined;
  return { kind, url, text, mime: node.mime };
}

export function buildWorkspaceFlow(input: {
  projectId: string;
  nodes: BoardNode[];
  edges: { id: string; sourceId: string; targetId: string }[];
  selectedId?: string | null;
  selectedEdgeId?: string | null;
  viewerName?: string;
}) {
  const viewerName = input.viewerName ?? "You";
  const edgeStroke = "#d3d1cb";
  const edgeStrokeSelected = "#111111";
  const nodes: Node<BoardNodeData>[] = input.nodes.map((node) => ({
    id: node.id,
    type: "board",
    position: { x: node.x, y: node.y },
    selected: input.selectedId === node.id,
    data: {
      kind: "board",
      title: titleFor(node),
      summary: summaryFor(node),
      typeLabel: typeLabelFor(node),
      action: undefined, // actionFor(node, viewerName),
      members: membersFor(node),
      attention: undefined, // attentionFor(node, viewerName),
      icon: iconFor(node.kind),
      preview: previewFor(input.projectId, node),
    },
  }));

  const edges: Edge[] = input.edges.map((edge) => {
    const selected = input.selectedEdgeId === edge.id;
    const stroke = selected ? edgeStrokeSelected : edgeStroke;
    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: "smoothstep",
      selected,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: stroke,
      },
      style: { stroke, strokeWidth: selected ? 2 : 1.5 },
    };
  });

  void actionFor;
  void attentionFor;
  void viewerName;

  return { nodes, edges };
}
