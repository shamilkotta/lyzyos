"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  ArrowUp,
  CaretDown,
  CaretLeft,
  CaretUp,
  Check,
  FileText,
  PencilSimple,
  Plus,
  SpinnerGap,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import {
  workspaceNodeTypes,
  type BoardNodeData,
  MemberAvatar,
  MemberStack,
} from "@/components/canvas/nodes/CanvasNodes";
import { DocMediaPreview, mediaKindFromPreview } from "@/components/docs/DocMediaPreview";
import {
  boardKindLabel,
  buildWorkspaceFlow,
  memberFromAuthor,
  membersFor,
  membersFromWorkspace,
} from "@/components/workspace/boardFlow";
import { CanvasToolbar, type CanvasTool } from "@/components/os/CanvasToolbar";
import { FloatingPanel } from "@/components/os/FloatingPanel";
import { TeamPresence } from "@/components/os/TeamPresence";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Markdown, type MentionTarget } from "@/components/ui/Markdown";
import { AddMembersPanel } from "@/components/os/AddMembersPanel";
import {
  addProjectDocument,
  createProjectEdge,
  deleteProjectEdge,
  deleteProjectNode,
  placeProjectNode,
  replyToCommentThread,
  updateProjectNode,
} from "@/lib/api";
import { debounce, type Debounced } from "@/lib/debounce";
import { PROJECT_DOC_ACCEPT, filterAllowedProjectDocs } from "@/lib/docs";
import type { BoardState, BoardNode } from "@/lib/project-types";
import { documentFileUrl, isCommentNode, isDocNode } from "@/lib/project-types";
import { useAddWorkspaceMembers, useProjectBoard } from "@/lib/queries/projects";
import { routes } from "@/lib/routes";
import { useCurrentUser } from "@/lib/session";
import { useProjectSync } from "@/lib/useProjectSync";
import type { Member } from "@/lib/types";

const POSITION_SAVE_MS = 450;

const MINIMAP_COLORS = {
  comment: "#fbf3db",
  note: "#ffffff",
  doc: "#e1f3fe",
} as const;

const SYNC_LABEL = {
  connecting: "Connecting…",
  live: "Synced",
  reconnecting: "Reconnecting…",
  offline: "Offline",
} as const;
const META_SAVE_MS = 550;

type Props = {
  projectId: string;
  workspaceId: string;
};

function WorkspaceCanvas({
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
}: {
  board: BoardState;
  selectedId: string | null;
  selectedEdgeId: string | null;
  tool: CanvasTool;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onPlace: (tool: CanvasTool, position: { x: number; y: number }) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onLink: (link: { sourceId: string; targetId: string }) => void;
  onUnlink: (edgeId: string) => void;
  onRemove: (nodeId: string) => void;
}) {
  const { user } = useCurrentUser();
  const viewerName = user?.name ?? "You";
  const flow = useMemo(
    () =>
      buildWorkspaceFlow({
        projectId: board.projectId,
        nodes: board.nodes,
        edges: board.edges,
        selectedId,
        selectedEdgeId,
        viewerName,
      }),
    [board.nodes, board.edges, board.projectId, selectedId, selectedEdgeId, viewerName],
  );
  const [nodes, setNodes] = useNodesState(flow.nodes);
  const [edges, setEdges] = useEdgesState(flow.edges);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const fittedFor = useRef<string | null>(null);
  const draggingNodeIds = useRef(new Set<string>());

  useEffect(() => {
    setNodes((current) => {
      if (draggingNodeIds.current.size === 0) return flow.nodes;
      const livePos = new Map(current.map((n) => [n.id, n.position]));
      return flow.nodes.map((fn) => {
        if (!draggingNodeIds.current.has(fn.id)) return fn;
        const position = livePos.get(fn.id);
        return position ? { ...fn, position } : fn;
      });
    });
    setEdges(flow.edges);
  }, [flow.nodes, flow.edges, setNodes, setEdges]);

  useEffect(() => {
    if (fittedFor.current === board.projectId) return;
    fittedFor.current = board.projectId;
    const t = window.setTimeout(() => fitView({ padding: 0.22, duration: 280 }), 40);
    return () => window.clearTimeout(t);
  }, [board.projectId, fitView]);

  const placeable = tool === "comment" || tool === "note" || tool === "doc";

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === "remove") onRemove(change.id);
      }
      const nonRemove = changes.filter((c) => c.type !== "remove");
      if (nonRemove.length > 0) {
        setNodes((nds) => applyNodeChanges(nonRemove, nds) as Node<BoardNodeData>[]);
      }
    },
    [onRemove, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === "remove") onUnlink(change.id);
      }
      const nonRemove = changes.filter((c) => c.type !== "remove");
      if (nonRemove.length > 0) {
        setEdges((eds) => applyEdgeChanges(nonRemove, eds));
      }
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
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onPlace(tool, position);
    },
    [busy, onPlace, onSelect, onSelectEdge, placeable, screenToFlowPosition, tool],
  );

  const onNodeDragStart = useCallback((_event: unknown, node: Node<BoardNodeData>) => {
    draggingNodeIds.current.add(node.id);
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node<BoardNodeData>) => {
      draggingNodeIds.current.delete(node.id);
      onMove(node.id, node.position);
    },
    [onMove],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || busy) return;
      if (connection.source === connection.target) return;
      onLink({ sourceId: connection.source, targetId: connection.target });
    },
    [busy, onLink],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, node: Node<BoardNodeData>) => {
        onSelectEdge(null);
        onSelect(node.id);
      }}
      onEdgeClick={(_, edge) => {
        onSelect(null);
        onSelectEdge(edge.id);
      }}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onPaneClick={onPaneClick}
      nodeTypes={workspaceNodeTypes}
      fitView
      minZoom={0.4}
      maxZoom={1.4}
      defaultEdgeOptions={{ type: "smoothstep" }}
      proOptions={{ hideAttribution: true }}
      panOnScroll
      selectionOnDrag={tool === "select"}
      panOnDrag={tool === "hand" ? true : tool === "select" ? [1, 2] : false}
      nodesDraggable={tool === "select"}
      nodesConnectable={tool === "select"}
      deleteKeyCode={tool === "select" ? ["Backspace", "Delete"] : null}
      edgesFocusable={tool === "select"}
      className={placeable ? "cursor-crosshair" : undefined}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d3d1cb" />
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={2}
        nodeColor={(n) => MINIMAP_COLORS[n.data?.icon as keyof typeof MINIMAP_COLORS] ?? "#ffffff"}
        className="!rounded-[8px] !border !border-border !bg-surface"
      />
      <Controls
        showInteractive={false}
        className="!rounded-[8px] !border !border-border !shadow-none"
      />
    </ReactFlow>
  );
}

export function WorkspaceBoard({ projectId, workspaceId: routeWorkspaceId }: Props) {
  const router = useRouter();
  const {
    data: boardData,
    error: boardError,
    refetch: refetchBoard,
  } = useProjectBoard(projectId, { workspaceId: routeWorkspaceId });
  const { mutateAsync: addMembersAsync } = useAddWorkspaceMembers(projectId, routeWorkspaceId);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>("select");
  const removedEdgeIds = useRef(new Set<string>());
  const removedNodeIds = useRef(new Set<string>());
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingDocPos = useRef<{ x: number; y: number } | null>(null);
  const pendingPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const debouncedPositionSave = useRef<Debounced<() => void> | null>(null);
  const debouncedMetaSave = useRef<Debounced<() => void> | null>(null);
  const metaDraftRef = useRef({ nodeId: "", title: "", body: "" });
  const metaDirtyRef = useRef(false);
  const boardRef = useRef<BoardState | null>(null);
  const loadError =
    boardError instanceof Error
      ? boardError.message
      : boardError
        ? "Failed to load workspace."
        : null;

  const workspaceId = board?.workspace.id ?? boardData?.workspace.id ?? routeWorkspaceId;
  const syncWorkspaceId = board?.workspace.id ?? boardData?.workspace.id ?? routeWorkspaceId;
  const workspaceName = board?.workspace.name ?? boardData?.workspace.name ?? "Workspace";
  const workspaceStatus = board?.workspace.status ?? boardData?.workspace.status ?? "in_progress";
  const workspaceAttention = board?.workspace.attention ?? boardData?.workspace.attention ?? null;

  const resolvedBoard = useMemo((): BoardState | null => {
    if (board?.projectId === projectId) {
      // Sync snapshots carry nodes/edges only; roster and agent id come from the REST board,
      // which may land after the first snapshot. Fill whatever the live board is missing.
      const fallback = boardData?.projectId === projectId ? boardData : null;
      const members = board.members.length > 0 ? board.members : (fallback?.members ?? []);
      if (members === board.members) return board;
      return { ...board, members };
    }
    if (!boardData || boardData.projectId !== projectId) return null;
    return boardData;
  }, [board, boardData, projectId]);

  useEffect(() => {
    boardRef.current = resolvedBoard;
  }, [resolvedBoard]);

  const updateBoard = useCallback(
    (updater: (prev: BoardState) => BoardState | null) => {
      setBoard((prev) => {
        const base =
          prev?.projectId === projectId
            ? prev
            : boardRef.current?.projectId === projectId
              ? boardRef.current
              : null;
        if (!base) return prev;
        return updater(base);
      });
    },
    [projectId],
  );

  useEffect(() => {
    const flushPositions = () => {
      const entries = [...pendingPositionsRef.current.entries()];
      if (entries.length === 0) return;
      pendingPositionsRef.current.clear();
      for (const [id, pos] of entries) {
        void updateProjectNode(projectId, workspaceId, id, pos).catch(() => {
          pendingPositionsRef.current.set(id, pos);
        });
      }
    };
    debouncedPositionSave.current = debounce(flushPositions, POSITION_SAVE_MS);
    return () => {
      debouncedPositionSave.current?.flush();
      debouncedPositionSave.current?.cancel();
      debouncedPositionSave.current = null;
    };
  }, [projectId, workspaceId]);

  const applyRemoteBoard = useCallback(
    (updater: (prev: BoardState | null) => BoardState | null) => {
      setBoard((prev) => {
        const base = prev?.projectId === projectId ? prev : boardRef.current;
        const next = updater(base);
        if (!next || !base || next.projectId !== base.projectId) return next;
        const pendingPos = pendingPositionsRef.current;
        const nodes =
          pendingPos.size === 0 && removedNodeIds.current.size === 0
            ? next.nodes
            : next.nodes
                .filter((n) => !removedNodeIds.current.has(n.id))
                .map((n) => {
                  const pos = pendingPos.get(n.id);
                  return pos ? { ...n, x: pos.x, y: pos.y } : n;
                });
        for (const id of removedNodeIds.current) {
          if (!next.nodes.some((n) => n.id === id)) removedNodeIds.current.delete(id);
        }
        const edges = next.edges.filter((e) => !removedEdgeIds.current.has(e.id));
        for (const id of removedEdgeIds.current) {
          if (!next.edges.some((e) => e.id === id)) removedEdgeIds.current.delete(id);
        }
        return { ...next, nodes, edges };
      });
    },
    [projectId],
  );

  const {
    status: syncStatus,
    peers,
    publishPresence,
  } = useProjectSync({
    workspaceId: syncWorkspaceId,
    enabled: Boolean(syncWorkspaceId),
    onBoard: applyRemoteBoard,
  });

  const presenceMembers = useMemo<Member[]>(() => {
    const onlineNames = new Set(peers.map((p) => p.name));
    const roster = membersFromWorkspace(resolvedBoard?.members ?? [], onlineNames);
    if (roster.length > 0) return roster;
    return membersFromWorkspace(
      peers.map((p) => ({ id: p.clientId, name: p.name })),
      onlineNames,
    );
  }, [peers, resolvedBoard?.members]);

  const mentionTargets = useMemo<MentionTarget[]>(
    () =>
      (resolvedBoard?.members ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
      })),
    [resolvedBoard?.members],
  );

  const workspaceMemberIds = useMemo(
    () => new Set((resolvedBoard?.members ?? []).map((m) => m.id)),
    [resolvedBoard?.members],
  );

  const selected = useMemo(
    () => resolvedBoard?.nodes.find((n) => n.id === selectedId) ?? null,
    [resolvedBoard?.nodes, selectedId],
  );

  useEffect(() => {
    if (selectedId && resolvedBoard && !resolvedBoard.nodes.some((n) => n.id === selectedId)) {
      setSelectedId(null);
      publishPresence(null);
    }
  }, [resolvedBoard, publishPresence, selectedId]);

  useEffect(() => {
    debouncedMetaSave.current?.flush();
    metaDirtyRef.current = false;
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) {
      setDraftTitle("");
      setDraftBody("");
      setAnswer("");
      return;
    }
    if (metaDirtyRef.current) return;
    setDraftTitle(selected.title);
    setDraftBody(selected.body);
    setAnswer("");
  }, [selected?.id, selected?.title, selected?.body, selected]);

  const reloadFromApi = useCallback(async () => {
    const result = await refetchBoard();
    const next = result.data;
    if (!next) return [];
    const nodes = next.nodes.filter((n) => !removedNodeIds.current.has(n.id));
    for (const id of removedNodeIds.current) {
      if (!next.nodes.some((n) => n.id === id)) removedNodeIds.current.delete(id);
    }
    const edges = next.edges.filter((e) => !removedEdgeIds.current.has(e.id));
    for (const id of removedEdgeIds.current) {
      if (!next.edges.some((e) => e.id === id)) removedEdgeIds.current.delete(id);
    }
    setBoard((prev) => ({
      ...next,
      nodes,
      edges,
      agentStatus: prev?.agentStatus ?? "idle",
      agentMessage: prev?.agentMessage,
    }));
    return nodes;
  }, [refetchBoard]);

  const onSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      publishPresence(id);
      if (id) {
        setSelectedEdgeId(null);
        setTool("select");
        setPanelCollapsed(false);
        setAddMembersOpen(false);
      }
    },
    [publishPresence],
  );

  const handleAddMembers = useCallback(
    async (userIds: string[]) => {
      const { members } = await addMembersAsync(userIds);
      updateBoard((prev) => ({ ...prev, members }));
    },
    [addMembersAsync, updateBoard],
  );

  const onSelectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    if (id) {
      setSelectedId(null);
      setPanelCollapsed(true);
    }
  }, []);

  const linkNodes = useCallback(
    (link: { sourceId: string; targetId: string }) => {
      const current = boardRef.current;
      if (!current) return;
      if (current.edges.some((e) => e.sourceId === link.sourceId && e.targetId === link.targetId)) {
        return;
      }

      const optimisticId = crypto.randomUUID();
      updateBoard((prev) => {
        if (prev.edges.some((e) => e.sourceId === link.sourceId && e.targetId === link.targetId)) {
          return prev;
        }
        return {
          ...prev,
          edges: [...prev.edges, { id: optimisticId, ...link }],
        };
      });

      void createProjectEdge(projectId, workspaceId, link)
        .then(({ edge }) => {
          updateBoard((currentBoard) => ({
            ...currentBoard,
            edges: currentBoard.edges.map((e) =>
              e.id === optimisticId
                ? { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId }
                : e,
            ),
          }));
        })
        .catch(() => {
          updateBoard((currentBoard) => ({
            ...currentBoard,
            edges: currentBoard.edges.filter((e) => e.id !== optimisticId),
          }));
        });
    },
    [projectId, updateBoard, workspaceId],
  );

  const unlinkEdge = useCallback(
    (edgeId: string) => {
      const current = boardRef.current;
      if (!current?.edges.some((e) => e.id === edgeId)) return;

      removedEdgeIds.current.add(edgeId);
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);

      updateBoard((prev) => {
        const nextEdges = prev.edges.filter((e) => e.id !== edgeId);
        if (nextEdges.length === prev.edges.length) return prev;
        return { ...prev, edges: nextEdges };
      });

      void deleteProjectEdge(projectId, workspaceId, edgeId).catch(() => {
        removedEdgeIds.current.delete(edgeId);
        void reloadFromApi();
      });
    },
    [projectId, reloadFromApi, selectedEdgeId, updateBoard, workspaceId],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const current = boardRef.current;
      if (!current?.nodes.some((n) => n.id === nodeId)) return;

      removedNodeIds.current.add(nodeId);
      pendingPositionsRef.current.delete(nodeId);
      if (selectedId === nodeId) {
        setSelectedId(null);
        publishPresence(null);
      }

      updateBoard((prev) => {
        if (!prev.nodes.some((n) => n.id === nodeId)) return prev;
        return {
          ...prev,
          nodes: prev.nodes.filter((n) => n.id !== nodeId),
          edges: prev.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId),
        };
      });

      void deleteProjectNode(projectId, workspaceId, nodeId).catch(() => {
        removedNodeIds.current.delete(nodeId);
        void reloadFromApi();
      });
    },
    [projectId, publishPresence, reloadFromApi, selectedId, updateBoard, workspaceId],
  );

  const moveNode = useCallback(
    (id: string, position: { x: number; y: number }) => {
      updateBoard((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id ? { ...n, x: position.x, y: position.y } : n)),
      }));
      pendingPositionsRef.current.set(id, position);
      debouncedPositionSave.current?.();
    },
    [updateBoard],
  );

  const persistNodeMeta = useCallback(
    async (nodeId: string, title: string, body: string) => {
      const { node } = await updateProjectNode(projectId, workspaceId, nodeId, {
        title,
        data: body,
      });
      const pending = metaDraftRef.current;
      if (pending.nodeId === nodeId && pending.title === title && pending.body === body) {
        metaDirtyRef.current = false;
      }
      if (!node) return;
      updateBoard((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? node : n)),
      }));
    },
    [projectId, updateBoard, workspaceId],
  );

  useEffect(() => {
    debouncedMetaSave.current?.cancel();
    debouncedMetaSave.current = debounce(() => {
      const { nodeId, title, body } = metaDraftRef.current;
      if (!nodeId) return;
      void persistNodeMeta(nodeId, title, body);
    }, META_SAVE_MS);
    return () => {
      debouncedMetaSave.current?.flush();
      debouncedMetaSave.current?.cancel();
      debouncedMetaSave.current = null;
    };
  }, [persistNodeMeta]);

  const placeOnCanvas = useCallback(
    async (activeTool: CanvasTool, position: { x: number; y: number }) => {
      if (busy) return;

      if (activeTool === "doc") {
        pendingDocPos.current = position;
        fileRef.current?.click();
        return;
      }

      if (activeTool !== "comment" && activeTool !== "note") return;

      setBusy(true);
      try {
        const kind = activeTool === "comment" ? "comment" : "note";
        const { node } = await placeProjectNode(projectId, workspaceId, {
          kind,
          title: kind === "comment" ? "" : "Untitled note",
          data: "",
          x: position.x,
          y: position.y,
        });
        if (node) {
          updateBoard((prev) => ({
            ...prev,
            nodes: prev.nodes.some((n) => n.id === node.id)
              ? prev.nodes.map((n) => (n.id === node.id ? node : n))
              : [...prev.nodes, node],
          }));
          onSelect(node.id);
        } else {
          const nodes = await reloadFromApi();
          const pick = nodes[nodes.length - 1]?.id ?? null;
          if (pick) onSelect(pick);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, onSelect, projectId, reloadFromApi, updateBoard, workspaceId],
  );

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || busy) return;
      const allowed = filterAllowedProjectDocs(files);
      if (allowed.length === 0) {
        return;
      }
      const position = pendingDocPos.current;
      pendingDocPos.current = null;
      setBusy(true);
      try {
        let lastNode: BoardNode | null = null;
        for (const file of allowed) {
          const result = await addProjectDocument(
            projectId,
            workspaceId,
            file,
            position ?? undefined,
          );
          if (result.node) {
            lastNode = result.node;
            updateBoard((prev) => ({
              ...prev,
              nodes: prev.nodes.some((n) => n.id === result.node!.id)
                ? prev.nodes.map((n) => (n.id === result.node!.id ? result.node! : n))
                : [...prev.nodes, result.node!],
            }));
          }
        }
        if (lastNode) {
          onSelect(lastNode.id);
        } else {
          const nodes = await reloadFromApi();
          const pick = [...nodes].reverse().find((n) => n.kind === "doc")?.id ?? null;
          if (pick) onSelect(pick);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, onSelect, projectId, reloadFromApi, updateBoard, workspaceId],
  );

  const editable =
    selected &&
    selected.authorKind === "human" &&
    (selected.kind === "note" || selected.kind === "doc");
  const editableDoc = selected && editable && isDocNode(selected) ? selected : null;
  const isComment = selected != null && isCommentNode(selected);
  const editingBody = selected != null && editingNodeId === selected.id;

  useEffect(() => {
    if (!editable || !selected || !metaDirtyRef.current) return;
    const title = selected.kind === "doc" ? draftTitle.trim() : draftTitle.trim() || selected.title;
    const body = selected.kind === "doc" ? selected.body : draftBody;
    if (title === selected.title && body === selected.body) {
      metaDirtyRef.current = false;
      return;
    }

    metaDraftRef.current = { nodeId: selected.id, title, body };
    debouncedMetaSave.current?.();
  }, [draftTitle, draftBody, editable, selected]);

  const markMetaDirty = useCallback(() => {
    metaDirtyRef.current = true;
  }, []);

  const submitComment = useCallback(async () => {
    const text = answer.trim();
    if (!selected || !isCommentNode(selected) || !text || busy) return;

    const threadId = selected.id;
    setBusy(true);
    try {
      const { node } = await replyToCommentThread(projectId, workspaceId, {
        threadId,
        message: text,
      });
      setAnswer("");
      if (!node) {
        void reloadFromApi();
        return;
      }
      updateBoard((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === threadId ? node : n)),
      }));
    } catch {
      void reloadFromApi();
    } finally {
      setBusy(false);
    }
  }, [answer, busy, projectId, reloadFromApi, selected, updateBoard, workspaceId]);

  const resolveComment = useCallback(async () => {
    if (!selected || !isCommentNode(selected) || busy) return;
    if (selected.status === "resolved") return;
  }, [selected, busy]);
  void resolveComment;

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-[14px] text-ink">{loadError}</p>
          <p className="mt-2 text-[13px] text-ink-secondary">
            Ensure <code className="font-mono text-[12px]">pnpm dev</code> is running (web +
            workers).
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => router.push(routes.project(projectId))}
          >
            Back to project
          </Button>
        </div>
      </div>
    );
  }

  if (!resolvedBoard) {
    return (
      <div className="flex h-full items-center justify-center">
        <SpinnerGap size={24} className="animate-spin text-ink-tertiary" />
      </div>
    );
  }

  const panelTitle = selected ? boardKindLabel(selected.kind) : "Inspector";

  return (
    <div className="relative h-full min-h-0">
      <div className="fade-up pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-start gap-2">
        <Button
          variant="secondary"
          className="pointer-events-auto h-8 shrink-0"
          onClick={() => router.push(routes.project(projectId))}
        >
          <CaretLeft size={14} weight="bold" />
          Campaign graph
        </Button>

        <div className="pointer-events-auto flex h-8 shrink-0 items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-3 backdrop-blur-md">
          <span className="text-[13px] font-medium text-ink">{workspaceName}</span>
          <StatusBadge
            tone={
              workspaceStatus === "complete" || workspaceStatus === "ready"
                ? "ok"
                : workspaceStatus === "blocked"
                  ? "danger"
                  : workspaceStatus === "in_review"
                    ? "warn"
                    : "info"
            }
          >
            {workspaceStatus === "complete"
              ? "Complete"
              : workspaceStatus === "ready"
                ? "Ready"
                : workspaceStatus === "blocked"
                  ? "Blocked"
                  : workspaceStatus === "in_review"
                    ? "In review"
                    : workspaceStatus === "not_started"
                      ? "Not started"
                      : "In progress"}
          </StatusBadge>
          <span
            title={SYNC_LABEL[syncStatus]}
            aria-label={SYNC_LABEL[syncStatus]}
            className="flex items-center gap-1.5 text-[11px] text-ink-tertiary"
          >
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                syncStatus === "live"
                  ? "bg-pale-green-ink"
                  : syncStatus === "offline"
                    ? "bg-ink-tertiary"
                    : "animate-pulse bg-pale-yellow-ink",
              )}
            />
            {syncStatus === "live" ? null : SYNC_LABEL[syncStatus]}
          </span>
        </div>

        {workspaceAttention ? (
          <button
            type="button"
            onClick={() => setAttentionExpanded((v) => !v)}
            aria-expanded={attentionExpanded}
            className={clsx(
              "pointer-events-auto flex min-w-0 max-w-md gap-1.5 rounded-[8px] bg-pale-yellow px-2.5 text-left text-[12px] leading-snug text-pale-yellow-ink shadow-sm backdrop-blur-md transition-colors hover:brightness-[0.98]",
              attentionExpanded ? "items-start py-2" : "h-8 items-center",
            )}
          >
            <Warning size={13} weight="bold" className="shrink-0" />
            <span className={clsx("min-w-0 flex-1", !attentionExpanded && "line-clamp-1")}>
              {workspaceAttention}
            </span>
            {attentionExpanded ? (
              <CaretUp size={12} weight="bold" className="mt-0.5 shrink-0 opacity-70" />
            ) : (
              <CaretDown size={12} weight="bold" className="shrink-0 opacity-70" />
            )}
          </button>
        ) : null}

        <div className="pointer-events-auto flex h-8 items-center">
          <TeamPresence
            members={presenceMembers}
            activeInFor={() => [workspaceName]}
            trailing={
              <button
                type="button"
                aria-label="Add workspace members"
                aria-expanded={addMembersOpen}
                onClick={() => {
                  setSelectedId(null);
                  setSelectedEdgeId(null);
                  setAddMembersOpen(true);
                }}
                className={clsx(
                  "relative flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border/80 bg-surface text-ink-secondary shadow-sm transition-transform hover:z-10 hover:scale-105 hover:border-ink/30 hover:text-ink",
                  addMembersOpen && "z-10 border-ink/40 text-ink ring-2 ring-ink/15",
                )}
              >
                <Plus size={12} weight="bold" />
              </button>
            }
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={PROJECT_DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <ReactFlowProvider>
        <WorkspaceCanvas
          board={resolvedBoard}
          selectedId={selectedId}
          selectedEdgeId={selectedEdgeId}
          tool={tool}
          busy={busy}
          onSelect={onSelect}
          onSelectEdge={onSelectEdge}
          onPlace={placeOnCanvas}
          onMove={moveNode}
          onLink={linkNodes}
          onUnlink={unlinkEdge}
          onRemove={removeNode}
        />
      </ReactFlowProvider>

      <CanvasToolbar mode="workspace" tool={tool} onTool={setTool} />

      {addMembersOpen ? (
        <AddMembersPanel
          title="Add members"
          alreadyLabel="Already on workspace"
          emptyAvailableLabel="Everyone is already on this workspace"
          memberIds={workspaceMemberIds}
          onClose={() => setAddMembersOpen(false)}
          onSubmit={handleAddMembers}
        />
      ) : null}

      {selected ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <FloatingPanel
            title={panelTitle}
            collapsed={panelCollapsed}
            onCollapsedChange={setPanelCollapsed}
            onClose={() => onSelect(null)}
            scrollToBottomKey={
              isCommentNode(selected) ? `${selected.id}:${selected.replies.length}` : undefined
            }
            footer={
              isComment ? (
                <div className="space-y-1.5">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          void submitComment();
                        }
                      }}
                      placeholder="Write a comment… Use @Name to mention someone."
                      className="min-h-[44px] flex-1 resize-none rounded-[10px] border border-border bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-tertiary"
                    />
                    <button
                      type="button"
                      disabled={busy || answer.trim().length === 0}
                      onClick={() => void submitComment()}
                      aria-label="Send comment"
                      className={
                        busy || answer.trim().length === 0
                          ? "flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-[8px] bg-surface-soft text-ink-tertiary"
                          : "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-ink text-white transition-colors hover:bg-[#333333]"
                      }
                    >
                      <ArrowUp size={15} weight="bold" />
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-tertiary">
                    Linked nodes are sent as context. ⌘↵ to send.
                  </p>
                </div>
              ) : undefined
            }
          >
            <section key={selected.id} className="fade-up flex min-h-full flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={
                    // isCommentNode(selected) && selected.status === "open"
                    //   ? "warn"
                    //   : isCommentNode(selected) && selected.status === "resolved"
                    //     ? "ok"
                    //     :
                    "neutral"
                  }
                >
                  {/* Open / Resolved labels — re-enable with open/resolve APIs.
                  {isCommentNode(selected) && selected.status === "open"
                    ? "Open"
                    : isCommentNode(selected) && selected.status === "resolved"
                      ? "Resolved"
                      : boardKindLabel(selected.kind)}
                  */}
                  {boardKindLabel(selected.kind)}
                </StatusBadge>
                {isComment ? (
                  <MemberStack members={membersFor(selected)} size="md" max={3} />
                ) : (
                  <MemberAvatar
                    member={memberFromAuthor(selected.authorKind, selected.authorName)}
                    size="md"
                  />
                )}
                {/* Resolve button — re-enable when resolve API ships.
                {isComment && selected.status !== "resolved" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resolveComment()}
                    className="flex h-7 items-center rounded-[6px] px-2 text-[12px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Resolve
                  </button>
                ) : null}
                */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeNode(selected.id)}
                  aria-label="Delete node"
                  className="ml-auto flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-tertiary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash size={13} weight="bold" />
                  Delete
                </button>
              </div>

              {editableDoc ? (
                <>
                  <input
                    value={draftTitle}
                    onChange={(e) => {
                      markMetaDirty();
                      setDraftTitle(e.target.value);
                    }}
                    onBlur={() => debouncedMetaSave.current?.flush()}
                    className="w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-[15px] font-medium tracking-[-0.02em] text-ink outline-none"
                    placeholder="Add a title…"
                  />
                  {editableDoc.docId ? (
                    <DocMediaPreview
                      url={documentFileUrl(projectId, editableDoc.docId)}
                      kind={mediaKindFromPreview(editableDoc.previewKind, editableDoc.mime)}
                      mime={editableDoc.mime}
                      title={draftTitle}
                      size="panel"
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-[8px] border border-border bg-canvas px-3 py-2 text-[12px] text-ink-secondary">
                      <FileText size={14} weight="bold" />
                      <span>No file preview</span>
                    </div>
                  )}
                </>
              ) : isComment ? (
                <div className="space-y-2">
                  {selected.body.trim().length > 0 ? (
                    <div className="rounded-[8px] border border-border bg-canvas px-3 py-2">
                      <p className="text-[11px] font-medium text-ink-secondary">
                        {selected.authorName}
                      </p>
                      <Markdown className="mt-0.5" mentions={mentionTargets}>
                        {selected.body}
                      </Markdown>
                    </div>
                  ) : (selected.replies?.length ?? 0) === 0 ? (
                    <p className="px-1 text-[13px] text-ink-tertiary">
                      No messages yet. Write below and send.
                    </p>
                  ) : null}

                  {selected.replies?.map((reply) => (
                    <div
                      key={reply.id}
                      className="rounded-[8px] border border-border bg-canvas px-3 py-2"
                    >
                      <p className="text-[11px] font-medium text-ink-secondary">
                        {reply.authorName}
                      </p>
                      <Markdown className="mt-0.5" mentions={mentionTargets}>
                        {reply.body}
                      </Markdown>
                    </div>
                  ))}
                </div>
              ) : editable ? (
                <>
                  <input
                    value={draftTitle}
                    onChange={(e) => {
                      markMetaDirty();
                      setDraftTitle(e.target.value);
                    }}
                    onBlur={() => debouncedMetaSave.current?.flush()}
                    className="w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-[15px] font-medium tracking-[-0.02em] text-ink outline-none"
                    placeholder="Title"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink-tertiary">
                      {editingBody ? "Markdown supported" : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingBody) debouncedMetaSave.current?.flush();
                        setEditingNodeId(editingBody ? null : selected.id);
                      }}
                      className="flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
                    >
                      {editingBody ? (
                        <Check size={13} weight="bold" />
                      ) : (
                        <PencilSimple size={13} weight="bold" />
                      )}
                      {editingBody ? "Done" : "Edit"}
                    </button>
                  </div>
                  {editingBody ? (
                    <textarea
                      autoFocus
                      value={draftBody}
                      onChange={(e) => {
                        markMetaDirty();
                        setDraftBody(e.target.value);
                      }}
                      onBlur={() => debouncedMetaSave.current?.flush()}
                      placeholder="Constraints, context, decisions… (markdown supported)"
                      className="min-h-[200px] w-full flex-1 resize-none rounded-[8px] border border-border bg-canvas px-3 py-3 text-[13px] leading-relaxed text-ink outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onDoubleClick={() => setEditingNodeId(selected.id)}
                      onClick={() => {
                        if (!draftBody.trim()) setEditingNodeId(selected.id);
                      }}
                      title="Double-click to edit"
                      className="min-h-[200px] w-full flex-1 cursor-text rounded-[8px] border border-border bg-canvas px-3 py-3 text-left"
                    >
                      {draftBody.trim() ? (
                        <Markdown>{draftBody}</Markdown>
                      ) : (
                        <span className="text-[13px] text-ink-tertiary">
                          Constraints, context, decisions… Click to write.
                        </span>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {selected.title.trim() ? (
                    <h2 className="text-[15px] font-medium tracking-[-0.02em] text-ink">
                      {selected.title}
                    </h2>
                  ) : null}

                  {isDocNode(selected) && selected.docId ? (
                    <DocMediaPreview
                      url={documentFileUrl(projectId, selected.docId)}
                      kind={mediaKindFromPreview(selected.previewKind, selected.mime)}
                      mime={selected.mime}
                      title={selected.title}
                      size="panel"
                    />
                  ) : isDocNode(selected) ? (
                    <div className="flex items-center gap-2 rounded-[8px] border border-border bg-canvas px-3 py-2 text-[12px] text-ink-secondary">
                      <FileText size={14} weight="bold" />
                      <span className="truncate">{selected.title || "Document"}</span>
                    </div>
                  ) : (
                    <div className="rounded-[8px] border border-border bg-canvas px-3 py-3">
                      {selected.body.trim().length > 0 ? (
                        <Markdown>{selected.body}</Markdown>
                      ) : (
                        <p className="text-[13px] text-ink-tertiary">No content yet.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </FloatingPanel>
        </div>
      ) : null}
    </div>
  );
}
