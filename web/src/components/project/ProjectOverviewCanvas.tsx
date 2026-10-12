"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import {
  OPEN_WORKSPACE_ATTR,
  overviewNodeTypes,
  type WorkspaceSummaryNode,
} from "@/components/canvas/nodes/CanvasNodes";
import type { CanvasTool } from "@/components/os/CanvasToolbar";
import { workStatusTone } from "@/lib/status";
import type { Member, WorkStatus } from "@/lib/types";

export type OverviewWorkspace = {
  id: string;
  name: string;
  status: WorkStatus;
  statusNote?: string | null;
  attention?: string | null;
  members: Member[];
};

const COLUMN_WIDTH = 320;
const PRO_OPTIONS = { hideAttribution: true };
const NO_EDGES: never[] = [];
const FIT_OPTIONS = { padding: 0.18 };
const DOT_COLOR = "#d3d1cb";

function toNodes(projectName: string, workspaces: OverviewWorkspace[]): WorkspaceSummaryNode[] {
  return workspaces.map((workspace, index) => ({
    id: workspace.id,
    type: "workspace",
    position: { x: 40 + index * COLUMN_WIDTH, y: 280 },
    data: {
      title: workspace.name,
      summary: workspace.statusNote ?? `${projectName} · open to collaborate with Lyzy`,
      tone: workStatusTone(workspace.status),
      status: workspace.status,
      members: workspace.members,
      attention: workspace.attention ?? undefined,
    },
  }));
}

type Props = {
  projectName: string;
  workspaces: OverviewWorkspace[];
  tool: CanvasTool;
  onSelect: (workspaceId: string | null) => void;
  onOpen: (workspaceId: string) => void;
};

export function ProjectOverviewCanvas({ projectName, workspaces, tool, onSelect, onOpen }: Props) {
  const derived = useMemo(() => toNodes(projectName, workspaces), [projectName, workspaces]);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkspaceSummaryNode>(derived);
  const { fitView } = useReactFlow();

  // Layout is local-only, so keep wherever the user dragged a card when data refreshes.
  useEffect(() => {
    setNodes((current) => {
      const positions = new Map(current.map((n) => [n.id, n.position]));
      return derived.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }));
    });
  }, [derived, setNodes]);

  // Refit only when the set of workspaces changes, not on every background refetch.
  const idsKey = workspaces.map((w) => w.id).join(",");
  useEffect(() => {
    const t = window.setTimeout(() => fitView({ ...FIT_OPTIONS, duration: 280 }), 40);
    return () => window.clearTimeout(t);
  }, [idsKey, fitView]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const hitOpen =
        event.target instanceof Element && event.target.closest(`[${OPEN_WORKSPACE_ATTR}]`);
      if (hitOpen) onOpen(node.id);
      else onSelect(node.id);
    },
    [onOpen, onSelect],
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => onOpen(node.id),
    [onOpen],
  );

  const onPaneClick = useCallback(() => onSelect(null), [onSelect]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={NO_EDGES}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={overviewNodeTypes}
        fitView
        fitViewOptions={FIT_OPTIONS}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={PRO_OPTIONS}
        panOnScroll
        selectionOnDrag={tool === "select"}
        panOnDrag={tool === "hand" ? true : [1, 2]}
        nodesDraggable={tool === "select"}
        nodesConnectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={DOT_COLOR} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor="#ffffff"
          maskColor="rgba(247,246,243,0.75)"
        />
      </ReactFlow>
    </div>
  );
}
