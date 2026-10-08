import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  branchBoards,
  departmentEdges,
  departmentLayout,
  departments,
  getMember,
  membersForDepartment,
} from "@/lib/data";
import type { DepartmentId, Member, WorkStatus } from "@/lib/types";
import type { BoardNodeData, DepartmentNodeData } from "./nodes/CanvasNodes";

export type OverviewWorkspace = {
  id: string;
  name: string;
  status: WorkStatus;
  statusNote?: string | null;
  attention?: string | null;
  members: Member[];
};

/** Prefix for real-workspace card ids on the project overview (vs. demo department ids). */
export const WORKSPACE_NODE_PREFIX = "workspace:";

function workspaceTone(status: WorkStatus): DepartmentNodeData["tone"] {
  switch (status) {
    case "complete":
    case "ready":
      return "ok";
    case "blocked":
      return "danger";
    case "in_review":
      return "warn";
    default:
      return "info";
  }
}

export function buildApiProjectOverviewNodes(
  projectName: string,
  workspaces: OverviewWorkspace[],
): Node<BoardNodeData>[] {
  return workspaces.map((workspace, index) => ({
    id: `${WORKSPACE_NODE_PREFIX}${workspace.id}`,
    type: "department",
    position: { x: 40 + index * 320, y: 280 },
    data: {
      kind: "department",
      title: workspace.name,
      summary: workspace.statusNote ?? `${projectName} · open to collaborate with Lyzy`,
      tone: workspaceTone(workspace.status),
      status: workspace.status,
      members: workspace.members,
      attention: workspace.attention ?? undefined,
      openLabel: "Open",
    } satisfies DepartmentNodeData,
  }));
}

export function buildApiProjectOverviewEdges(): Edge[] {
  return [];
}

export function buildOverviewNodes(): Node<BoardNodeData>[] {
  return departments.map((dept) => ({
    id: dept.id,
    type: "department",
    position: departmentLayout[dept.id],
    data: {
      kind: "department",
      title: dept.name,
      summary: dept.summary,
      tone: dept.tone,
      status: dept.status,
      members: membersForDepartment(dept.id),
      branchCount: dept.branches?.length,
      attention: dept.attention,
    } satisfies DepartmentNodeData,
  }));
}

export function buildOverviewEdges(): Edge[] {
  return departmentEdges.map(([source, target]) => ({
    id: `e-${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: "#d3d1cb",
    },
    style: { stroke: "#d3d1cb" },
  }));
}

export function buildBranchNodes(departmentId: DepartmentId): Node<BoardNodeData>[] {
  const items = branchBoards[departmentId] ?? [];
  return items.map((item) => {
    const author = getMember(item.authorId);
    return {
      id: item.id,
      type: item.kind,
      position: { x: item.x, y: item.y },
      data: {
        kind: item.kind,
        title: item.title,
        body: item.body,
        tone: item.tone,
        meta: item.meta,
        authorName: author?.name,
        authorKind: author?.kind,
        authorInitials: author?.initials,
      },
    };
  });
}

export function buildBranchEdges(departmentId: DepartmentId): Edge[] {
  if (departmentId === "creative") {
    return [
      {
        id: "e-cr-li3-blocker",
        source: "cr-li3",
        target: "cr-blocker",
        type: "smoothstep",
        style: { stroke: "#9f2f2d" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: "#9f2f2d",
        },
      },
      {
        id: "e-cr-instruction-li3",
        source: "cr-instruction",
        target: "cr-li3",
        type: "smoothstep",
        style: { stroke: "#d3d1cb" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: "#d3d1cb",
        },
      },
    ];
  }

  if (departmentId === "compliance") {
    return [
      {
        id: "e-co-claim-suggest",
        source: "co-claim",
        target: "co-suggest",
        type: "smoothstep",
        style: { stroke: "#d3d1cb" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: "#d3d1cb",
        },
      },
      {
        id: "e-co-claim-comment",
        source: "co-claim",
        target: "co-comment",
        type: "smoothstep",
        style: { stroke: "#d3d1cb" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: "#d3d1cb",
        },
      },
    ];
  }

  if (departmentId === "localization") {
    return [
      {
        id: "e-loc-de-blocker",
        source: "loc-de",
        target: "loc-blocker",
        type: "smoothstep",
        style: { stroke: "#9f2f2d" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: "#9f2f2d",
        },
      },
    ];
  }

  return [];
}
