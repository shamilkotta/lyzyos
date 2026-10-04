"use client";

import { useCallback, useMemo } from "react";
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
import { campaignEdges, campaignNodes } from "./campaignBoard";
import { nodeTypes, type BoardNodeData } from "./nodes/CanvasNodes";
import type { InspectorSelection, NodeKind } from "@/lib/types";

type Props = {
  onSelect: (selection: InspectorSelection) => void;
  tool: string;
};

let noteCounter = 0;

export function CampaignCanvas({ onSelect, tool }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(campaignNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(campaignEdges);
  const { screenToFlowPosition } = useReactFlow();

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
      onSelect({
        type: "node",
        id: node.id,
        kind: node.data.kind,
        title: node.data.title,
        subtitle: node.data.subtitle,
      });
    },
    [onSelect],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const placeable = ["comment", "note", "blocker", "agent", "asset"];
      if (placeable.includes(tool)) {
        noteCounter += 1;
        const id = `${tool}-${noteCounter}`;
        const kind = (tool === "asset" ? "asset" : tool) as NodeKind;
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const titles: Record<string, string> = {
          comment: "New comment",
          note: "Untitled note",
          blocker: "New blocker",
          agent: "Agent pin",
          asset: "New asset",
        };

        const newNode: Node<BoardNodeData> = {
          id,
          type: kind,
          position,
          data: {
            kind,
            title: titles[tool] ?? "Item",
            subtitle:
              tool === "comment"
                ? "You · just now"
                : tool === "agent"
                  ? "Idle · waiting for task"
                  : tool === "asset"
                    ? "Draft · unassigned"
                    : undefined,
            tone: tool === "blocker" ? "danger" : tool === "agent" ? "info" : "neutral",
            agentStatus: tool === "agent" ? "idle" : undefined,
          },
        };

        setNodes((nds) => [...nds, newNode]);
        onSelect({
          type: "node",
          id,
          kind,
          title: newNode.data.title,
          subtitle: newNode.data.subtitle,
        });
        return;
      }

      onSelect({ type: "none" });
    },
    [onSelect, screenToFlowPosition, setNodes, tool],
  );

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
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: "smoothstep" }}
        proOptions={proOptions}
        panOnScroll
        selectionOnDrag={tool === "select"}
        panOnDrag={tool === "hand" ? true : tool === "select" ? [1, 2] : false}
        nodesDraggable={tool === "select"}
        nodesConnectable={tool === "connect" || tool === "select"}
        className={placeableCursor(tool) ? "cursor-crosshair" : undefined}
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
            if (kind === "agent") return "#e1f3fe";
            if (kind === "comment") return "#fbf3db";
            if (kind === "launch") return "#111111";
            return "#ffffff";
          }}
          maskColor="rgba(247,246,243,0.75)"
        />
      </ReactFlow>
    </div>
  );
}

function placeableCursor(tool: string) {
  return ["comment", "note", "blocker", "agent", "asset"].includes(tool);
}
