"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useReactFlow,
  type Connection,
  type EdgeChange,
  type Node,
} from "@xyflow/react";
import { FileText, SpinnerGap } from "@phosphor-icons/react";
import { planningNodeTypes, type BoardNodeData } from "@/components/canvas/nodes/CanvasNodes";
import { DocMediaPreview, mediaKindFromPreview } from "@/components/docs/DocMediaPreview";
import { buildPlanningFlow } from "@/components/planning/planningBoard";
import { CanvasToolbar, type CanvasTool } from "@/components/os/CanvasToolbar";
import { FloatingPanel } from "@/components/os/FloatingPanel";
import { TeamPresence } from "@/components/os/TeamPresence";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  addProjectDocument,
  answerProjectQuestion,
  createProjectEdge,
  deleteProjectEdge,
  getProjectBoard,
  placeProjectNode,
  updateProjectNode,
} from "@/lib/api";
import { debounce, type Debounced } from "@/lib/debounce";
import { PROJECT_DOC_ACCEPT, filterAllowedProjectDocs } from "@/lib/docs";
import type { BoardState, PlanningNode } from "@/lib/project-types";
import { documentFileUrl } from "@/lib/project-types";
import { useProjectSync } from "@/lib/useProjectSync";
import type { Member } from "@/lib/types";

const POSITION_SAVE_MS = 450;
const META_SAVE_MS = 550;

type Props = {
  projectId: string;
  onBack: () => void;
};

function kindLabel(kind: PlanningNode["kind"]) {
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
      return "Comment";
    case "answer":
      return "Reply";
    default:
      return "Item";
  }
}

function isExchange(kind: PlanningNode["kind"]) {
  return kind === "question" || kind === "answer";
}

function PlanningCanvas({
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
}) {
  const flow = useMemo(
    () =>
      buildPlanningFlow({
        projectId: board.projectId,
        nodes: board.nodes,
        edges: board.edges,
        selectedId,
        selectedEdgeId,
      }),
    [board.nodes, board.edges, board.projectId, selectedId, selectedEdgeId],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
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
      onNodesChange={onNodesChange}
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
      nodeTypes={planningNodeTypes}
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
      edgesFocusable={tool === "select"}
      edgesDeletable={tool === "select"}
      className={placeable ? "cursor-crosshair" : undefined}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#e8e6e0" />
      <MiniMap pannable zoomable className="!rounded-[8px] !border !border-border !bg-surface" />
      <Controls
        showInteractive={false}
        className="!rounded-[8px] !border !border-border !shadow-none"
      />
    </ReactFlow>
  );
}

export function PlanningWorkspace({ projectId, onBack }: Props) {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [answer, setAnswer] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>("select");
  const removedEdgeIds = useRef(new Set<string>());
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingDocPos = useRef<{ x: number; y: number } | null>(null);
  const pendingPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const debouncedPositionSave = useRef<Debounced<() => void> | null>(null);
  const debouncedMetaSave = useRef<Debounced<() => void> | null>(null);
  const metaDraftRef = useRef({ nodeId: "", title: "", body: "" });
  /** Only true after local typing — prevents remote sync from re-saving stale drafts. */
  const metaDirtyRef = useRef(false);

  useEffect(() => {
    const flushPositions = () => {
      const entries = [...pendingPositionsRef.current.entries()];
      if (entries.length === 0) return;
      pendingPositionsRef.current.clear();
      for (const [id, pos] of entries) {
        void updateProjectNode(projectId, id, pos).catch(() => {
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
  }, [projectId]);

  const applyRemoteBoard = useCallback(
    (updater: (prev: BoardState | null) => BoardState | null) => {
      setBoard((prev) => {
        const next = updater(prev);
        if (!next || !prev || next.projectId !== prev.projectId) return next;
        // Keep in-flight local drags / pending edge deletes stable.
        const pendingPos = pendingPositionsRef.current;
        const nodes =
          pendingPos.size === 0
            ? next.nodes
            : next.nodes.map((n) => {
                const pos = pendingPos.get(n.id);
                return pos ? { ...n, x: pos.x, y: pos.y } : n;
              });
        const edges = next.edges.filter((e) => !removedEdgeIds.current.has(e.id));
        for (const id of removedEdgeIds.current) {
          if (!next.edges.some((e) => e.id === id)) removedEdgeIds.current.delete(id);
        }
        return { ...next, nodes, edges };
      });
    },
    [],
  );

  const {
    status: syncStatus,
    peers,
    publishPresence,
  } = useProjectSync({
    projectId,
    onBoard: applyRemoteBoard,
  });

  const presenceMembers = useMemo<Member[]>(
    () =>
      peers.map((p) => ({
        id: p.clientId,
        name: p.name,
        role: "Collaborator",
        kind: "human" as const,
        initials:
          p.name
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "?",
        status: "online" as const,
        departmentIds: ["planning"],
      })),
    [peers],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initial = await getProjectBoard(projectId);
        if (cancelled) return;
        setBoard({
          projectId: initial.project.id,
          projectName: initial.project.name,
          planningStatus: initial.project.planningStatus,
          threadId: initial.project.threadId,
          nodes: initial.nodes,
          edges: initial.edges,
          agentStatus: "idle",
        });
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load project.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selected = useMemo(
    () => board?.nodes.find((n) => n.id === selectedId) ?? null,
    [board?.nodes, selectedId],
  );

  // Flush pending edits for the previous node, then accept remote drafts for the new one.
  useEffect(() => {
    debouncedMetaSave.current?.flush();
    metaDirtyRef.current = false;
  }, [selected?.id]);

  // Keep inspector drafts in sync with the board unless the user is mid-edit.
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
    const next = await getProjectBoard(projectId);
    setBoard((prev) => ({
      projectId: next.project.id,
      projectName: next.project.name,
      planningStatus: next.project.planningStatus,
      threadId: next.project.threadId,
      nodes: next.nodes,
      edges: next.edges,
      agentStatus: prev?.agentStatus ?? "idle",
      agentMessage: prev?.agentMessage,
    }));
    return next.nodes;
  }, [projectId]);

  const onSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      publishPresence(id);
      if (id) {
        setSelectedEdgeId(null);
        setTool("select");
        setPanelCollapsed(false);
      }
    },
    [publishPresence],
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
      const optimisticId = crypto.randomUUID();
      let added = false;
      setBoard((prev) => {
        if (!prev) return prev;
        const exists = prev.edges.some(
          (e) => e.sourceId === link.sourceId && e.targetId === link.targetId,
        );
        if (exists) return prev;
        added = true;
        return {
          ...prev,
          edges: [...prev.edges, { id: optimisticId, ...link }],
        };
      });
      if (!added) return;

      void createProjectEdge(projectId, link)
        .then(({ edge }) => {
          setBoard((current) => {
            if (!current) return current;
            return {
              ...current,
              edges: current.edges.map((e) => (e.id === optimisticId ? edge : e)),
            };
          });
        })
        .catch(() => {
          setBoard((current) => {
            if (!current) return current;
            return {
              ...current,
              edges: current.edges.filter((e) => e.id !== optimisticId),
            };
          });
        });
    },
    [projectId],
  );

  const unlinkEdge = useCallback(
    (edgeId: string) => {
      removedEdgeIds.current.add(edgeId);
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);

      let removed = false;
      setBoard((prev) => {
        if (!prev) return prev;
        const nextEdges = prev.edges.filter((e) => e.id !== edgeId);
        if (nextEdges.length === prev.edges.length) return prev;
        removed = true;
        return { ...prev, edges: nextEdges };
      });
      if (!removed) return;

      void deleteProjectEdge(projectId, edgeId).catch(() => {
        removedEdgeIds.current.delete(edgeId);
        void reloadFromApi();
      });
    },
    [projectId, reloadFromApi, selectedEdgeId],
  );

  const moveNode = useCallback((id: string, position: { x: number; y: number }) => {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id ? { ...n, x: position.x, y: position.y } : n)),
      };
    });
    pendingPositionsRef.current.set(id, position);
    debouncedPositionSave.current?.();
  }, []);

  const persistNodeMeta = useCallback(
    async (nodeId: string, title: string, body: string) => {
      const { node } = await updateProjectNode(projectId, nodeId, { title, text: body });
      // Clear dirty only if the user hasn't typed again while the request was in flight.
      const pending = metaDraftRef.current;
      if (pending.nodeId === nodeId && pending.title === title && pending.body === body) {
        metaDirtyRef.current = false;
      }
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === nodeId ? node : n)),
        };
      });
    },
    [projectId],
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
        const kind = activeTool === "comment" ? "question" : "note";
        const { node } = await placeProjectNode(projectId, {
          kind,
          title: kind === "question" ? "Comment" : "Untitled note",
          text: "",
          x: position.x,
          y: position.y,
        });
        await reloadFromApi();
        onSelect(node.id);
      } finally {
        setBusy(false);
      }
    },
    [busy, onSelect, projectId, reloadFromApi],
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
        let lastId: string | null = null;
        for (const file of allowed) {
          const result = await addProjectDocument(projectId, file, position ?? undefined);
          lastId = result.node?.id ?? lastId;
        }
        const nodes = await reloadFromApi();
        const pick = lastId ?? nodes.find((n) => n.kind === "doc")?.id ?? null;
        if (pick) onSelect(pick);
      } finally {
        setBusy(false);
      }
    },
    [busy, onSelect, projectId, reloadFromApi],
  );

  const editable =
    selected &&
    selected.authorKind === "human" &&
    (selected.kind === "note" || selected.kind === "question" || selected.kind === "doc");
  const docEditable = Boolean(selected && selected.kind === "doc" && editable);

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

  const submitAnswer = useCallback(async () => {
    const text = answer.trim();
    if (!selected || selected.kind !== "question" || !text || busy) return;
    setBusy(true);
    try {
      await answerProjectQuestion(projectId, selected.id, text);
      setAnswer("");
      await reloadFromApi();
    } finally {
      setBusy(false);
    }
  }, [answer, selected, busy, projectId, reloadFromApi]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-[14px] text-ink">{loadError}</p>
          <p className="mt-2 text-[13px] text-ink-secondary">
            Start the API with <code className="font-mono text-[12px]">pnpm api dev</code>.
          </p>
          <Button className="mt-4" variant="secondary" onClick={onBack}>
            Back to project
          </Button>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center">
        <SpinnerGap size={24} className="animate-spin text-ink-tertiary" />
      </div>
    );
  }

  const panelTitle = selected ? kindLabel(selected.kind) : "Inspector";
  const panelSubtitle = selected
    ? isExchange(selected.kind)
      ? "Agent ↔ human exchange"
      : "Full content"
    : "Place items on the board";

  return (
    <div className="relative h-full min-h-0">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
        <div className="pointer-events-auto flex items-baseline gap-2 rounded-[8px] border border-border bg-surface/95 px-3 py-2 backdrop-blur-md">
          <span className="text-[13px] font-medium tracking-[-0.02em] text-ink">Planning</span>
          <span className="text-[12px] text-ink-tertiary">·</span>
          <span
            className={
              syncStatus === "live"
                ? "text-[12px] text-ink-secondary"
                : syncStatus === "reconnecting"
                  ? "text-[12px] text-amber-800"
                  : "text-[12px] text-ink-tertiary"
            }
          >
            {syncStatus === "live"
              ? "Synced"
              : syncStatus === "reconnecting"
                ? "Reconnecting…"
                : syncStatus === "connecting"
                  ? "Connecting…"
                  : "Offline"}
          </span>
        </div>
        {presenceMembers.length > 0 ? <TeamPresence members={presenceMembers} /> : null}
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
        <PlanningCanvas
          board={board}
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
        />
      </ReactFlowProvider>

      <CanvasToolbar mode="planning" tool={tool} onTool={setTool} />

      {selected ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <FloatingPanel
            title={panelTitle}
            subtitle={panelSubtitle}
            collapsed={panelCollapsed}
            onCollapsedChange={setPanelCollapsed}
            onClose={() => onSelect(null)}
          >
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={
                    selected.kind === "question" && selected.status !== "answered"
                      ? "warn"
                      : selected.authorKind === "agent"
                        ? "info"
                        : "neutral"
                  }
                >
                  {kindLabel(selected.kind)}
                </StatusBadge>
                <span className="text-[12px] text-ink-secondary">
                  {selected.authorName}
                  {selected.authorKind === "agent" ? " · Agent" : ""}
                </span>
              </div>

              {docEditable ? (
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
                  {selected.docId ? (
                    <DocMediaPreview
                      url={documentFileUrl(projectId, selected.docId)}
                      kind={mediaKindFromPreview(selected.previewKind, selected.mime)}
                      mime={selected.mime}
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
                  <textarea
                    value={draftBody}
                    onChange={(e) => {
                      markMetaDirty();
                      setDraftBody(e.target.value);
                    }}
                    onBlur={() => debouncedMetaSave.current?.flush()}
                    rows={8}
                    placeholder={
                      selected.kind === "question"
                        ? "Message to Lyzy…"
                        : "Constraints, context, decisions…"
                    }
                    className="w-full resize-none rounded-[8px] border border-border bg-canvas px-3 py-3 text-[13px] leading-relaxed text-ink outline-none"
                  />
                </>
              ) : (
                <>
                  {selected.title.trim() ? (
                    <h2 className="text-[15px] font-medium tracking-[-0.02em] text-ink">
                      {selected.title}
                    </h2>
                  ) : null}

                  {selected.kind === "doc" && selected.docId ? (
                    <DocMediaPreview
                      url={documentFileUrl(projectId, selected.docId)}
                      kind={mediaKindFromPreview(selected.previewKind, selected.mime)}
                      mime={selected.mime}
                      title={selected.title}
                      size="panel"
                    />
                  ) : selected.kind === "doc" ? (
                    <div className="flex items-center gap-2 rounded-[8px] border border-border bg-canvas px-3 py-2 text-[12px] text-ink-secondary">
                      <FileText size={14} weight="bold" />
                      <span className="truncate">{selected.title || "Document"}</span>
                    </div>
                  ) : (
                    <div className="rounded-[8px] border border-border bg-canvas px-3 py-3">
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                        {selected.body.trim().length > 0 ? selected.body : "No content yet."}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selected.kind === "question" &&
              selected.authorKind === "agent" &&
              selected.status !== "answered" ? (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
                    Reply
                  </p>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={4}
                    placeholder="Your answer…"
                    className="w-full resize-none rounded-[8px] border border-border bg-canvas px-3 py-2 text-[13px] text-ink outline-none"
                  />
                  <Button
                    disabled={busy || answer.trim().length === 0}
                    onClick={() => void submitAnswer()}
                  >
                    Send answer
                  </Button>
                </div>
              ) : null}
            </section>
          </FloatingPanel>
        </div>
      ) : null}
    </div>
  );
}
