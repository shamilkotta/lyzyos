import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { PlanningNode } from "@/lib/project-types";
import { documentFileUrl } from "@/lib/project-types";
import type { BoardNodeData, PlanningCardData } from "@/components/canvas/nodes/CanvasNodes";
import type { Member } from "@/lib/types";

function nodeLabel(kind: PlanningNode["kind"]): string {
  switch (kind) {
    case "brief":
      return "Brief";
    case "doc":
      return "Document";
    case "note":
      return "Note";
    case "summary":
      return "Summary";
    case "question":
      return "Question";
    case "answer":
      return "Answer";
    default:
      return "Item";
  }
}

function iconFor(kind: PlanningNode["kind"]): PlanningCardData["icon"] {
  if (kind === "doc") return "doc";
  if (kind === "question" || kind === "answer") return "comment";
  return "note";
}

function typeLabelFor(node: PlanningNode): string {
  if (node.kind === "question") return "Comment";
  return nodeLabel(node.kind);
}

function actionFor(node: PlanningNode): PlanningCardData["action"] | undefined {
  if (node.kind !== "question") return undefined;
  if (node.status === "answered") {
    return { tone: "ok", variant: "answered" };
  }
  return { tone: "warn", variant: "needs_reply" };
}

function titleFor(node: PlanningNode): string {
  if (node.kind === "doc") {
    // Empty until the user sets a title in the inspector.
    return node.title.trim();
  }
  if (node.kind === "question" || node.kind === "answer") {
    return nodeLabel(node.kind);
  }
  const title = node.title.trim();
  if (!title || title === "Untitled note" || title === "Note" || title === "Comment") {
    return nodeLabel(node.kind);
  }
  return title;
}

function summaryFor(node: PlanningNode): string {
  if (node.kind === "doc") return "";
  const body = node.body.trim();
  if (node.kind === "question" || node.kind === "answer") {
    if (body.length === 0) return "No message yet — open to edit.";
    return body.length > 140 ? `${body.slice(0, 140)}…` : body;
  }
  if (body.length === 0) return "No content yet — open to edit.";
  return body.length > 140 ? `${body.slice(0, 140)}…` : body;
}

function memberFor(node: PlanningNode): Member {
  const initials =
    node.authorKind === "agent"
      ? "LZ"
      : node.authorName
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "YO";

  return {
    id: `${node.authorKind}-${node.authorName}`,
    name: node.authorName,
    role: node.authorKind === "agent" ? "Agent" : "You",
    kind: node.authorKind,
    initials,
    status: "online",
    departmentIds: ["planning"],
  };
}

function attentionFor(node: PlanningNode): string | undefined {
  if (node.kind === "question" && node.status !== "answered" && node.authorKind === "agent") {
    return "Lyzy is waiting on your reply";
  }
  return undefined;
}

function previewFor(
  projectId: string,
  node: PlanningNode,
): PlanningCardData["preview"] | undefined {
  if (node.kind !== "doc") return undefined;
  const kind = node.previewKind ?? "file";
  const url = node.docId ? documentFileUrl(projectId, node.docId) : undefined;
  const text =
    kind === "text" && node.body.trim().length > 0 ? node.body.trim().slice(0, 280) : undefined;
  return { kind, url, text, mime: node.mime };
}

export function buildPlanningFlow(input: {
  projectId: string;
  nodes: PlanningNode[];
  edges: { id: string; sourceId: string; targetId: string }[];
  selectedId?: string | null;
  selectedEdgeId?: string | null;
}): { nodes: Node<BoardNodeData>[]; edges: Edge[] } {
  const edgeStroke = "#d3d1cb";
  const edgeStrokeSelected = "#111111";
  const nodes: Node<BoardNodeData>[] = input.nodes.map((node) => ({
    id: node.id,
    type: "planning",
    position: { x: node.x, y: node.y },
    selected: input.selectedId === node.id,
    data: {
      kind: "planning",
      title: titleFor(node),
      summary: summaryFor(node),
      typeLabel: typeLabelFor(node),
      action: actionFor(node),
      members: [memberFor(node)],
      attention: attentionFor(node),
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

  return { nodes, edges };
}
