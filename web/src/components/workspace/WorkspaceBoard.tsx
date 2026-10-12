"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { SpinnerGapIcon, XIcon } from "@phosphor-icons/react";
import { AddMembersPanel } from "@/components/os/AddMembersPanel";
import { CanvasToolbar, type CanvasTool } from "@/components/os/CanvasToolbar";
import { AddMemberButton, TeamPresence } from "@/components/os/TeamPresence";
import { Button } from "@/components/ui/Button";
import type { MentionTarget } from "@/components/ui/Markdown";
import { filterAllowedProjectDocs, PROJECT_DOC_ACCEPT } from "@/lib/docs";
import { membersFromRoster } from "@/lib/members";
import { useAddWorkspaceMembers, useAgentStatus } from "@/lib/queries/projects";
import { routes } from "@/lib/routes";
import { useCurrentUser } from "@/lib/session";
import { NodePanel } from "./NodePanel";
import { useWorkspaceBoard } from "./useWorkspaceBoard";
import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { WorkspaceHeader } from "./WorkspaceHeader";

type Point = { x: number; y: number };

type Props = {
  projectId: string;
  workspaceId: string;
};

export function WorkspaceBoard({ projectId, workspaceId: routeWorkspaceId }: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingDocPos = useRef<Point | null>(null);
  const [panelAliases, setPanelAliases] = useState<Record<string, string>>({});

  const onNodeConfirmed = useCallback((optimisticId: string, realId: string) => {
    setPanelAliases((prev) => ({ ...prev, [realId]: optimisticId }));
    setSelectedId((current) => (current === optimisticId ? realId : current));
  }, []);

  const {
    board,
    loadError,
    actionError,
    dismissActionError,
    sync,
    moveNode,
    linkNodes,
    unlinkEdge,
    removeNode,
    placeNode,
    uploadDocuments,
    saveNode,
    replyToThread,
    setMembers,
  } = useWorkspaceBoard({
    projectId,
    routeWorkspaceId,
    author: user ? { id: user.id, name: user.name } : null,
    onNodeConfirmed,
  });

  const { mutateAsync: addMembers } = useAddWorkspaceMembers(
    projectId,
    board?.workspace.id ?? routeWorkspaceId,
  );
  const agentWorking = useAgentStatus(projectId);
  const { peers, publishPresence } = sync;

  const selected = useMemo(
    () => board?.nodes.find((n) => n.id === selectedId) ?? null,
    [board?.nodes, selectedId],
  );
  const effectiveSelectedId = selected?.id ?? null;

  useEffect(() => {
    publishPresence(effectiveSelectedId);
  }, [effectiveSelectedId, publishPresence, sync.status]);

  const members = board?.members;
  const presenceMembers = useMemo(() => {
    const onlineNames = peers.map((p) => p.name);
    const roster = members?.length ? members : peers.map((p) => ({ id: p.clientId, name: p.name }));
    return membersFromRoster(roster, { onlineNames, agentWorking });
  }, [agentWorking, members, peers]);

  const mentionTargets = useMemo<MentionTarget[]>(
    () => (members ?? []).map((m) => ({ id: m.id, name: m.name, kind: m.kind })),
    [members],
  );
  const workspaceMemberIds = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);

  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    setSelectedEdgeId(null);
    setTool("select");
    setPanelCollapsed(false);
    setAddMembersOpen(false);
  }, []);

  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    if (id) setSelectedId(null);
  }, []);

  const placeOnCanvas = useCallback(
    (activeTool: CanvasTool, position: Point) => {
      if (activeTool === "doc") {
        pendingDocPos.current = position;
        fileRef.current?.click();
      } else if (activeTool === "note" || activeTool === "comment") {
        selectNode(placeNode(activeTool, position));
      }
    },
    [placeNode, selectNode],
  );

  const onFiles = async (files: FileList | null) => {
    const allowed = files ? filterAllowedProjectDocs(files) : [];
    const position = pendingDocPos.current ?? { x: 0, y: 0 };
    pendingDocPos.current = null;
    if (allowed.length === 0 || uploading) return;
    setUploading(true);
    try {
      const lastId = await uploadDocuments(allowed, position);
      if (lastId) selectNode(lastId);
    } finally {
      setUploading(false);
    }
  };

  const handleAddMembers = useCallback(
    async (userIds: string[]) => {
      const result = await addMembers(userIds);
      setMembers(result.members);
    },
    [addMembers, setMembers],
  );

  const backToProject = useCallback(
    () => router.push(routes.project(projectId)),
    [projectId, router],
  );

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-[14px] text-ink">{loadError.message || "Failed to load workspace."}</p>
          <Button className="mt-4" variant="secondary" onClick={backToProject}>
            Back to project
          </Button>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
        <SpinnerGapIcon size={24} className="animate-spin text-ink-tertiary" />
      </div>
    );
  }

  const workspaceName = board.workspace.name;

  return (
    <div className="relative h-full min-h-0">
      <WorkspaceHeader
        name={workspaceName}
        status={board.workspace.status ?? "in_progress"}
        attention={board.workspace.attention ?? null}
        syncStatus={sync.status}
        onBack={backToProject}
        presence={
          <TeamPresence
            members={presenceMembers}
            activeInFor={() => [workspaceName]}
            trailing={
              <AddMemberButton
                label="Add workspace members"
                open={addMembersOpen}
                onClick={() => {
                  setSelectedId(null);
                  setSelectedEdgeId(null);
                  setAddMembersOpen(true);
                }}
              />
            }
          />
        }
      />

      {actionError ? (
        <div
          role="alert"
          className="fade-up absolute left-1/2 top-16 z-30 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-[8px] border border-pale-red-ink/20 bg-pale-red px-3 py-2 text-[12px] text-pale-red-ink shadow-sm"
        >
          <span className="min-w-0 flex-1">{actionError}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissActionError}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] hover:bg-pale-red-ink/10"
          >
            <XIcon size={11} weight="bold" />
          </button>
        </div>
      ) : null}

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
          board={board}
          selectedId={effectiveSelectedId}
          selectedEdgeId={selectedEdgeId}
          tool={tool}
          busy={uploading}
          onSelect={selectNode}
          onSelectEdge={selectEdge}
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
        <NodePanel
          projectId={projectId}
          node={selected}
          panelKey={panelAliases[selected.id] ?? selected.id}
          collapsed={panelCollapsed}
          onCollapsedChange={setPanelCollapsed}
          mentions={mentionTargets}
          busy={uploading}
          onClose={() => selectNode(null)}
          onDelete={() => removeNode(selected.id)}
          onSave={saveNode}
          onReply={replyToThread}
        />
      ) : null}
    </div>
  );
}
