import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  branchBoards,
  departmentEdges,
  departmentLayout,
  departments,
  getMember,
  membersForDepartment,
} from "@/lib/data";
import type { DepartmentId } from "@/lib/types";
import type { BoardNodeData } from "./nodes/CanvasNodes";

export function buildApiProjectOverviewNodes(projectName: string): Node<BoardNodeData>[] {
  return [
    {
      id: "planning",
      type: "department",
      position: { x: 340, y: 280 },
      data: {
        kind: "department" as const,
        title: "Planning",
        summary: `${projectName} · intake and discovery with Lyzy`,
        tone: "info",
        status: "in_progress",
        members: membersForDepartment("planning"),
        attention: "Lyzy is structuring the brief",
        openLabel: "Open",
      },
    },
  ];
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
      kind: "department" as const,
      title: dept.name,
      summary: dept.summary,
      tone: dept.tone,
      status: dept.status,
      members: membersForDepartment(dept.id),
      branchCount: dept.branches?.length,
      attention: dept.attention,
    },
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
