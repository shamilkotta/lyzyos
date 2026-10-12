"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import {
  boardNodeTypes,
  type BoardCardKind,
  type BoardCardNode,
} from "@/components/canvas/nodes/CanvasNodes";
import { isPlacementTool, type CanvasTool } from "@/components/os/canvasTools";
import type { BoardState } from "@/lib/project-types";
import { buildFlowEdges, buildFlowNodes } from "./boardFlow";

const MINIMAP_COLORS: Record<BoardCardKind, string> = {
  comment: "#fbf3db",
  note: "#ffffff",
  doc: "#e1f3fe",
};
const PRO_OPTIONS = { hideAttribution: true };
const DEFAULT_EDGE_OPTIONS = { type: "smoothstep" };
const DELETE_KEYS = ["Backspace", "Delete"];
const FIT_OPTIONS = { padding: 0.22, duration: 280 };
const DOT_COLOR = "#d3d1cb";

const minimapColor = (node: BoardCardNode) => MINIMAP_COLORS[node.data.icon] ?? "#ffffff";

type Point = { x: number; y: number };

type Props = {
  board: BoardState;
  selectedId: string | null;
  selectedEdgeId: string | null;
  tool: CanvasTool;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onPlace: (tool: CanvasTool, position: Point) => void;
  onMove: (id: string, position: Point) => void;
  onLink: (link: { sourceId: string; targetId: string }) => void;
  onUnlink: (edgeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export function WorkspaceCanvas({
  board,
  selectedId,
  selectedEdgeId,
  tool,
  busy,
  onSelect,
  onSelectEdge,
  onPlace,
  onMove,
  onLink,
  onUnlink,
  onRemove,
}: Props) {
  const flowNodes = useMemo(
    () => buildFlowNodes(board.projectId, board.nodes, selectedId),
    [board.projectId, board.nodes, selectedId],
  );
  const flowEdges = useMemo(
    () => buildFlowEdges(board.edges, selectedEdgeId),
    [board.edges, selectedEdgeId],
  );
  const [nodes, setNodes] = useNodesState(flowNodes);
  const [edges, setEdges] = useEdgesState(flowEdges);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const draggingIds = useRef(new Set<string>());

  // Mirror board state into React Flow, but never yank a card out from under the pointer.
  useEffect(() => {
    setNodes((current) => {
      if (draggingIds.current.size === 0) return flowNodes;
      const live = new Map(current.map((n) => [n.id, n.position]));
      return flowNodes.map((n) =>
        draggingIds.current.has(n.id) ? { ...n, position: live.get(n.id) ?? n.position } : n,
      );
    });
  }, [flowNodes, setNodes]);

  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  useEffect(() => {
    const t = window.setTimeout(() => fitView(FIT_OPTIONS), 40);
    return () => window.clearTimeout(t);
  }, [fitView]);

  const placeable = isPlacementTool(tool);

  // Removals go through the board (optimistic + persisted); everything else is view state.
  const handleNodesChange = useCallback(
    (changes: NodeChange<BoardCardNode>[]) => {
      const rest = changes.filter((c) => {
        if (c.type !== "remove") return true;
        onRemove(c.id);
        return false;
      });
      if (rest.length) setNodes((nds) => applyNodeChanges(rest, nds));
    },
    [onRemove, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const rest = changes.filter((c) => {
        if (c.type !== "remove") return true;
        onUnlink(c.id);
        return false;
      });
      if (rest.length) setEdges((eds) => applyEdgeChanges(rest, eds));
    },
    [onUnlink, setEdges],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (busy) return;
      if (!placeable) {
        onSelect(null);
        onSelectEdge(null);
        return;
      }
      onPlace(tool, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [busy, onPlace, onSelect, onSelectEdge, placeable, screenToFlowPosition, tool],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: BoardCardNode) => onSelect(node.id),
    [onSelect],
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => onSelectEdge(edge.id),
    [onSelectEdge],
  );

  const onNodeDragStart = useCallback((_event: unknown, node: BoardCardNode) => {
    draggingIds.current.add(node.id);
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: BoardCardNode) => {
      draggingIds.current.delete(node.id);
      onMove(node.id, node.position);
    },
    [onMove],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (busy || !connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      onLink({ sourceId: connection.source, targetId: connection.target });
    },
    [busy, onLink],
  );

  const selecting = tool === "select";

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onPaneClick={onPaneClick}
      nodeTypes={boardNodeTypes}
      fitView
      minZoom={0.4}
      maxZoom={1.4}
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      proOptions={PRO_OPTIONS}
      panOnScroll
      selectionOnDrag={selecting}
      panOnDrag={tool === "hand" ? true : selecting ? [1, 2] : false}
      nodesDraggable={selecting}
      nodesConnectable={selecting}
      deleteKeyCode={selecting ? DELETE_KEYS : null}
      edgesFocusable={selecting}
      className={placeable ? "cursor-crosshair" : undefined}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={DOT_COLOR} />
      <MiniMap<BoardCardNode>
        pannable
        zoomable
        nodeStrokeWidth={2}
        nodeColor={minimapColor}
        className="!rounded-[8px] !border !border-border !bg-surface"
      />
      <Controls
        showInteractive={false}
        className="!rounded-[8px] !border !border-border !shadow-none"
      />
    </ReactFlow>
  );
}
