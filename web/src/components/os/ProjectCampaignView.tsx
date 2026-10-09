"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { Archive, CaretLeft, Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { CampaignCanvas } from "@/components/canvas/CampaignCanvas";
import { CanvasToolbar, type CanvasTool } from "./CanvasToolbar";
import { Inspector } from "./Inspector";
import { TeamPresence } from "./TeamPresence";
import { AddMembersPanel } from "./AddMembersPanel";
import { getDepartment, members, membersForDepartment, spaces } from "@/lib/data";
import {
  useAddProjectMembers,
  useArchiveProject,
  useCreateWorkspace,
  useProject,
  useProjectWorkspaces,
} from "@/lib/queries/projects";
import { membersFromWorkspace } from "@/components/workspace/boardFlow";
import type { OverviewWorkspace } from "@/components/canvas/boardBuilders";
import { routes } from "@/lib/routes";
import type { DepartmentId, InspectorSelection } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

type BoardMode = "overview" | "branch";

type Props = {
  projectId?: string;
  projectName?: string;
  spaceId?: string;
  onApplyFix?: () => void;
};

export function ProjectCampaignView({
  projectId,
  projectName,
  spaceId = "secureedge",
  onApplyFix,
}: Props) {
  const router = useRouter();
  const isProject = Boolean(projectId);
  const { data: project } = useProject(projectId ?? "", { enabled: isProject });
  const { data: projectWorkspaces } = useProjectWorkspaces(projectId ?? "", {
    enabled: isProject,
  });
  const [boardMode, setBoardMode] = useState<BoardMode>("overview");
  const [departmentId, setDepartmentId] = useState<DepartmentId | undefined>();
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selection, setSelection] = useState<InspectorSelection>({ type: "none" });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const createPopoverRef = useRef<HTMLDivElement>(null);
  const createWorkspace = useCreateWorkspace(projectId ?? "");
  const { mutateAsync: addProjectMembersAsync } = useAddProjectMembers(projectId ?? "");
  const { mutate: archiveProjectMutate, isPending: isArchiving } = useArchiveProject(
    projectId ?? "",
  );
  const [confirmArchive, setConfirmArchive] = useState(false);

  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0];
  const department = departmentId ? getDepartment(departmentId) : undefined;
  const title = projectId ? projectName || "Project" : space.name;

  const closeCreateWorkspace = useCallback(() => {
    setShowCreateWorkspace(false);
    setNewWorkspaceName("");
  }, []);

  const openWorkspace = useCallback(
    (workspaceId: string) => {
      if (!projectId) return;
      router.push(routes.projectWorkspace(projectId, workspaceId));
    },
    [projectId, router],
  );

  const overviewWorkspaces = useMemo<OverviewWorkspace[]>(
    () =>
      (projectWorkspaces ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status ?? "in_progress",
        statusNote: w.statusNote,
        attention: w.attention,
        members: membersFromWorkspace(w.members),
      })),
    [projectWorkspaces],
  );

  const handleCreateWorkspace = useCallback(async () => {
    const name = newWorkspaceName.trim();
    if (!name || !projectId) return;
    await createWorkspace.mutateAsync({ name });
    closeCreateWorkspace();
  }, [newWorkspaceName, projectId, createWorkspace, closeCreateWorkspace]);

  useEffect(() => {
    if (!showCreateWorkspace) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!createPopoverRef.current?.contains(event.target as Node)) {
        closeCreateWorkspace();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCreateWorkspace();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showCreateWorkspace, closeCreateWorkspace]);

  const presenceMembers = useMemo(() => {
    // Real projects show their roster (every workspace + project member, Lyzy included).
    if (isProject) return membersFromWorkspace(project?.members ?? []);
    if (boardMode === "branch" && departmentId) {
      return membersForDepartment(departmentId);
    }
    return members.filter((m) => m.status !== "away").slice(0, 8);
  }, [boardMode, departmentId, isProject, project?.members]);

  const projectMemberIds = useMemo(
    () => new Set(project?.projectMemberIds ?? []),
    [project?.projectMemberIds],
  );

  const handleAddProjectMembers = useCallback(
    async (userIds: string[]) => {
      await addProjectMembersAsync(userIds);
    },
    [addProjectMembersAsync],
  );

  const openDepartment = useCallback((id: DepartmentId) => {
    setBoardMode("branch");
    setDepartmentId(id);
    setTool("select");
    setSelection({ type: "none" });
    setInspectorOpen(false);
  }, []);

  const enterDepartment = useCallback(
    (id: DepartmentId) => {
      openDepartment(id);
    },
    [openDepartment],
  );

  const backToOverview = useCallback(() => {
    setBoardMode("overview");
    setDepartmentId(undefined);
    setTool("select");
    setSelection({ type: "none" });
  }, []);

  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        {boardMode === "branch" ? (
          <Button variant="secondary" className="pointer-events-auto h-8" onClick={backToOverview}>
            <CaretLeft size={14} weight="bold" />
            Campaign graph
          </Button>
        ) : null}

        <div className="pointer-events-auto flex items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-3 py-1.5 backdrop-blur-md">
          <span className="text-[13px] font-medium text-ink">
            {boardMode === "overview" ? title : (department?.name ?? "Department")}
          </span>
          {boardMode === "overview" ? (
            <StatusBadge tone="info">Overview</StatusBadge>
          ) : (
            <StatusBadge tone={department?.tone ?? "neutral"}>Workspace</StatusBadge>
          )}
        </div>

        {boardMode === "overview" && isProject ? (
          <div ref={createPopoverRef} className="pointer-events-auto relative">
            <Button
              variant="secondary"
              className="h-8"
              aria-expanded={showCreateWorkspace}
              aria-haspopup="dialog"
              onClick={() => setShowCreateWorkspace((open) => !open)}
            >
              <Plus size={13} weight="bold" />
              Add workspace
            </Button>
            {showCreateWorkspace ? (
              <div
                role="dialog"
                aria-label="New workspace"
                className="absolute left-0 top-full z-30 mt-2 w-72 rounded-[10px] border border-border bg-surface p-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)] fade-up"
              >
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
                    Workspace name
                  </span>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Brand, Social, Localization"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateWorkspace();
                    }}
                    className="w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-ink-secondary focus:outline-none"
                  />
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeCreateWorkspace}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!newWorkspaceName.trim() || createWorkspace.isPending}
                    onClick={() => void handleCreateWorkspace()}
                  >
                    {createWorkspace.isPending ? "Creating…" : "Create"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {boardMode === "overview" && isProject ? (
          <div className="pointer-events-auto relative">
            {confirmArchive ? (
              <div className="flex items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-3 py-1.5 backdrop-blur-md">
                <span className="text-[12px] text-ink-secondary">Archive this project?</span>
                <button
                  type="button"
                  disabled={isArchiving}
                  onClick={() => {
                    archiveProjectMutate(undefined, {
                      onSuccess: () => router.push(routes.projects),
                    });
                  }}
                  className="text-[12px] font-medium text-red-500 transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {isArchiving ? "Archiving…" : "Archive"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(false)}
                  className="text-[12px] text-ink-tertiary transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Archive project"
                onClick={() => setConfirmArchive(true)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border bg-surface/95 text-ink-tertiary backdrop-blur-md transition-colors hover:border-border-strong hover:text-ink"
              >
                <Archive size={14} />
              </button>
            )}
          </div>
        ) : null}

        {isProject || presenceMembers.length > 0 ? (
          <div className="pointer-events-auto flex h-8 items-center">
            <TeamPresence
              members={presenceMembers}
              activeInFor={
                isProject
                  ? (member) =>
                      overviewWorkspaces
                        .filter((w) => w.members.some((m) => m.id === member.id))
                        .map((w) => w.name)
                  : undefined
              }
              trailing={
                isProject && boardMode === "overview" ? (
                  <button
                    type="button"
                    aria-label="Add project members"
                    aria-expanded={addMembersOpen}
                    onClick={() => {
                      setInspectorOpen(false);
                      setSelection({ type: "none" });
                      setAddMembersOpen(true);
                    }}
                    className={clsx(
                      "relative flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border/80 bg-surface text-ink-secondary shadow-sm transition-transform hover:z-10 hover:scale-105 hover:border-ink/30 hover:text-ink",
                      addMembersOpen && "z-10 border-ink/40 text-ink ring-2 ring-ink/15",
                    )}
                  >
                    <Plus size={12} weight="bold" />
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {boardMode === "overview" && !isProject ? (
          <p className="pointer-events-none hidden text-[12px] text-ink-tertiary lg:block">
            Double-click a department to enter
          </p>
        ) : null}
      </div>

      <ReactFlowProvider>
        <CampaignCanvas
          mode={boardMode}
          departmentId={departmentId}
          tool={tool}
          apiProjectName={boardMode === "overview" && projectId ? title : undefined}
          apiWorkspaces={overviewWorkspaces}
          onOpenWorkspace={projectId ? openWorkspace : undefined}
          onOpenDepartment={enterDepartment}
          onSelect={(next) => {
            setSelection(next);
            setInspectorOpen(next.type !== "none");
            if (next.type !== "none") setAddMembersOpen(false);
          }}
        />
      </ReactFlowProvider>

      <CanvasToolbar mode={boardMode} tool={tool} onTool={setTool} />

      {addMembersOpen && isProject ? (
        <AddMembersPanel
          title="Add project members"
          alreadyLabel="Already on project"
          emptyAvailableLabel="Everyone is already on this project"
          memberIds={projectMemberIds}
          onClose={() => setAddMembersOpen(false)}
          onSubmit={handleAddProjectMembers}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-20">
        <Inspector
          open={inspectorOpen && !addMembersOpen}
          selection={selection}
          mode={boardMode}
          departmentId={departmentId}
          onClose={() => {
            setInspectorOpen(false);
            setSelection({ type: "none" });
          }}
          onOpenDepartment={enterDepartment}
          onOpenWorkspace={projectId ? openWorkspace : undefined}
          onApplyFix={onApplyFix ?? (() => undefined)}
        />
      </div>
    </div>
  );
}
