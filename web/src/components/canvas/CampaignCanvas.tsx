"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
} from "@xyflow/react";
import {
  buildBranchEdges,
  buildBranchNodes,
  buildOverviewEdges,
  buildOverviewNodes,
} from "./boardBuilders";
import {
  branchNodeTypes,
  overviewNodeTypes,
  type BoardNodeData,
  type DepartmentNodeData,
  type ItemNodeData,
} from "./nodes/CanvasNodes";
import type { DepartmentId, InspectorSelection } from "@/lib/types";

type Props = {
  mode: "overview" | "branch";
  departmentId?: DepartmentId;
  tool: string;
  onSelect: (selection: InspectorSelection) => void;
  onOpenDepartment: (id: DepartmentId) => void;
};

let placeCounter = 0;

export function CampaignCanvas({ mode, departmentId, tool, onSelect, onOpenDepartment }: Props) {
  const initialNodes = useMemo(
    () =>
      mode === "overview" ? buildOverviewNodes() : buildBranchNodes(departmentId ?? "creative"),
    [mode, departmentId],
  );
  const initialEdges = useMemo(
    () =>
      mode === "overview" ? buildOverviewEdges() : buildBranchEdges(departmentId ?? "creative"),
    [mode, departmentId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    const t = window.setTimeout(() => fitView({ padding: 0.18, duration: 280 }), 40);
    return () => window.clearTimeout(t);
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            style: { stroke: "#d3d1cb" },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<BoardNodeData>) => {
      if (node.data.kind === "department") {
        const data = node.data as DepartmentNodeData;
        onSelect({
          type: "department",
          id: node.id as DepartmentId,
          title: data.title,
          subtitle: data.summary,
        });
        return;
      }

      const data = node.data as ItemNodeData;
      onSelect({
        type: "item",
        id: node.id,
        kind: data.kind,
        title: data.title,
        subtitle: data.body,
        departmentId: departmentId ?? "creative",
      });
    },
    [departmentId, onSelect],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<BoardNodeData>) => {
      if (mode === "overview" && node.data.kind === "department") {
        onOpenDepartment(node.id as DepartmentId);
      }
    },
    [mode, onOpenDepartment],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (mode !== "branch") {
        onSelect({ type: "none" });
        return;
      }

      const placeable = ["comment", "note", "blocker", "instruction", "work"];
      if (!placeable.includes(tool)) {
        onSelect({ type: "none" });
        return;
      }

      placeCounter += 1;
      const kind = tool as ItemNodeData["kind"];
      const id = `${kind}-${placeCounter}`;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const titles: Record<string, string> = {
        comment: "New comment",
        note: "Untitled note",
        blocker: "New blocker",
        instruction: "New instruction",
        work: "New work item",
      };

      const newNode: Node<BoardNodeData> = {
        id,
        type: kind,
        position,
        data: {
          kind,
          title: titles[tool] ?? "Item",
          authorName: "You",
          authorKind: "human",
          authorInitials: "MK",
          meta: tool === "comment" ? "just now" : undefined,
          tone: tool === "blocker" ? "danger" : "neutral",
        },
      };

      setNodes((nds) => [...nds, newNode]);
      onSelect({
        type: "item",
        id,
        kind,
        title: newNode.data.title,
        departmentId: departmentId ?? "creative",
      });
    },
    [departmentId, mode, onSelect, screenToFlowPosition, setNodes, tool],
  );

  const nodeTypes = mode === "overview" ? overviewNodeTypes : branchNodeTypes;
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.3}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: "smoothstep" }}
        proOptions={proOptions}
        panOnScroll
        selectionOnDrag={tool === "select"}
        panOnDrag={tool === "hand" ? true : tool === "select" ? [1, 2] : false}
        nodesDraggable={tool === "select"}
        nodesConnectable={tool === "connect" || tool === "select"}
        className={
          mode === "branch" && ["comment", "note", "blocker", "instruction", "work"].includes(tool)
            ? "cursor-crosshair"
            : undefined
        }
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d3d1cb" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const kind = (n.data as BoardNodeData | undefined)?.kind;
            if (kind === "blocker") return "#fdebec";
            if (kind === "comment") return "#fbf3db";
            if (kind === "instruction") return "#e1f3fe";
            if (kind === "department") return "#ffffff";
            return "#ffffff";
          }}
          maskColor="rgba(247,246,243,0.75)"
        />
      </ReactFlow>
    </div>
  );
}
