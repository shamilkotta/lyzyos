import { MarkerType, type Edge } from "@xyflow/react";
import type { BoardCardData, BoardCardNode } from "@/components/canvas/nodes/CanvasNodes";
import { toMember } from "@/lib/members";
import {
  documentFileUrl,
  isCommentNode,
  type BoardEdge,
  type BoardNode,
} from "@/lib/project-types";
import type { Member } from "@/lib/types";

const KIND_LABEL: Record<BoardNode["kind"], string> = {
  doc: "Document",
  note: "Note",
  comment: "Comment",
};

export function boardKindLabel(kind: BoardNode["kind"]) {
  return KIND_LABEL[kind];
}

const DEFAULT_NOTE_TITLES = new Set(["", "Untitled note", "Note"]);

function titleFor(node: BoardNode) {
  if (node.kind === "comment") return "";
  const title = node.title.trim();
  if (node.kind === "note" && DEFAULT_NOTE_TITLES.has(title)) return KIND_LABEL.note;
  return title;
}

/** Cards render markdown clipped by height, so this only bounds render cost. */
const SUMMARY_MAX_CHARS = 600;

function summaryFor(node: BoardNode) {
  if (node.kind === "doc") return "";
  const latest = isCommentNode(node) ? (node.replies.at(-1)?.body.trim() ?? "") : "";
  const body = (latest || node.body).trim();
  if (!body) return `No ${node.kind === "comment" ? "message" : "content"} yet — open to edit.`;
  return body.slice(0, SUMMARY_MAX_CHARS);
}

/** Author first, then everyone who replied to the thread. */
export function membersFor(node: BoardNode): Member[] {
  const byId = new Map<string, Member>();
  const add = (kind: BoardNode["authorKind"], name: string) => {
    if (!name.trim()) return;
    const member = toMember(kind, name);
    if (!byId.has(member.id)) byId.set(member.id, member);
  };
  add(node.authorKind, node.authorName);
  if (isCommentNode(node)) {
    for (const reply of node.replies) add(reply.authorKind, reply.authorName);
  }
  return [...byId.values()];
}

function previewFor(projectId: string, node: BoardNode): BoardCardData["preview"] {
  if (node.kind !== "doc") return undefined;
  const text =
    node.previewKind === "text" ? node.body.trim().slice(0, 280) || undefined : undefined;
  return {
    kind: node.previewKind,
    url: node.docId ? documentFileUrl(projectId, node.docId) : undefined,
    text,
    mime: node.mime,
  };
}

function toCardData(projectId: string, node: BoardNode): BoardCardData {
  return {
    title: titleFor(node),
    summary: summaryFor(node),
    typeLabel: KIND_LABEL[node.kind],
    members: membersFor(node),
    icon: node.kind,
    preview: previewFor(projectId, node),
  };
}

/**
 * Board nodes are immutable (every change produces a new object), so card data can be cached by
 * node identity. Unchanged cards then keep the same `data` reference and their memoized
 * renderer — markdown parsing included — is skipped.
 */
const cardDataCache = new WeakMap<BoardNode, BoardCardData>();

function cardData(projectId: string, node: BoardNode) {
  let data = cardDataCache.get(node);
  if (!data) {
    data = toCardData(projectId, node);
    cardDataCache.set(node, data);
  }
  return data;
}

export function buildFlowNodes(
  projectId: string,
  nodes: BoardNode[],
  selectedId: string | null,
): BoardCardNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "board",
    position: { x: node.x, y: node.y },
    selected: node.id === selectedId,
    data: cardData(projectId, node),
  }));
}

const EDGE_STROKE = "#d3d1cb";
const EDGE_STROKE_SELECTED = "#111111";

export function buildFlowEdges(edges: BoardEdge[], selectedEdgeId: string | null): Edge[] {
  return edges.map((edge) => {
    const selected = edge.id === selectedEdgeId;
    const stroke = selected ? EDGE_STROKE_SELECTED : EDGE_STROKE;
    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: "smoothstep",
      selected,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
      style: { stroke, strokeWidth: selected ? 2 : 1.5 },
    };
  });
}
