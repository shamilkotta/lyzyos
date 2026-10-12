"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { ArchiveIcon, PlusIcon } from "@phosphor-icons/react";
import { AddMembersPanel } from "@/components/os/AddMembersPanel";
import { CanvasToolbar, type CanvasTool } from "@/components/os/CanvasToolbar";
import { AddMemberButton, TeamPresence } from "@/components/os/TeamPresence";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { membersFromRoster } from "@/lib/members";
import {
  useAddProjectMembers,
  useCreateWorkspace,
  useProject,
  useProjectWorkspaces,
  useSetProjectArchived,
} from "@/lib/queries/projects";
import { routes } from "@/lib/routes";
import { ProjectOverviewCanvas, type OverviewWorkspace } from "./ProjectOverviewCanvas";
import { WorkspaceInspector } from "./WorkspaceInspector";

const chipClass =
  "pointer-events-auto flex h-8 items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-3 backdrop-blur-md";

function CreateWorkspaceButton({ projectId }: { projectId: string }) {
  const createWorkspace = useCreateWorkspace(projectId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setName("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || createWorkspace.isPending) return;
    createWorkspace.mutate({ name: trimmed }, { onSuccess: close });
  };

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <Button
        variant="secondary"
        className="h-8"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <PlusIcon size={13} weight="bold" />
        Add workspace
      </Button>
      {open ? (
        <form
          role="dialog"
          aria-label="New workspace"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="absolute left-0 top-full z-30 mt-2 w-72 rounded-[10px] border border-border bg-surface p-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)] fade-up"
        >
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
              Workspace name
            </span>
            <input
              autoFocus
              type="text"
              maxLength={80}
              placeholder="e.g. Brand, Social, Localization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[8px] border border-border bg-canvas px-3 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-ink-secondary focus:outline-none"
            />
          </label>
          {createWorkspace.error ? (
            <p className="mt-2 text-[12px] text-pale-red-ink">{createWorkspace.error.message}</p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createWorkspace.isPending}>
              {createWorkspace.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ArchiveProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { mutate, isPending } = useSetProjectArchived(projectId);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label="Archive project"
        title="Archive project"
        onClick={() => setConfirming(true)}
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-[8px] border border-border bg-surface/95 text-ink-tertiary backdrop-blur-md transition-colors hover:border-border-strong hover:text-ink"
      >
        <ArchiveIcon size={14} />
      </button>
    );
  }

  return (
    <div className={chipClass}>
      <span className="text-[12px] text-ink-secondary">Archive this project?</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => mutate(true, { onSuccess: () => router.push(routes.projects) })}
        className="text-[12px] font-medium text-pale-red-ink transition-opacity hover:opacity-70 disabled:opacity-40"
      >
        {isPending ? "Archiving…" : "Archive"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[12px] text-ink-tertiary transition-colors hover:text-ink"
      >
        Cancel
      </button>
    </div>
  );
}

export function ProjectOverview({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data: project, error: projectError } = useProject(projectId);
  const { data: projectWorkspaces } = useProjectWorkspaces(projectId);
  const { mutateAsync: addProjectMembers } = useAddProjectMembers(projectId);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addMembersOpen, setAddMembersOpen] = useState(false);

  const projectName = project?.name ?? "Project";

  const workspaces = useMemo<OverviewWorkspace[]>(
    () =>
      (projectWorkspaces ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status ?? "in_progress",
        statusNote: w.statusNote,
        attention: w.attention,
        members: membersFromRoster(w.members),
      })),
    [projectWorkspaces],
  );

  const presenceMembers = useMemo(
    () => membersFromRoster(project?.members ?? []),
    [project?.members],
  );
  const projectMemberIds = useMemo(
    () => new Set(project?.projectMemberIds ?? []),
    [project?.projectMemberIds],
  );
  const selectedWorkspace = workspaces.find((w) => w.id === selectedId) ?? null;

  const openWorkspace = useCallback(
    (workspaceId: string) => router.push(routes.projectWorkspace(projectId, workspaceId)),
    [projectId, router],
  );

  const selectWorkspace = useCallback((workspaceId: string | null) => {
    setSelectedId(workspaceId);
    if (workspaceId) setAddMembersOpen(false);
  }, []);

  const activeIn = useCallback(
    (member: { id: string }) =>
      workspaces.filter((w) => w.members.some((m) => m.id === member.id)).map((w) => w.name),
    [workspaces],
  );

  const handleAddProjectMembers = useCallback(
    async (userIds: string[]) => {
      await addProjectMembers(userIds);
    },
    [addProjectMembers],
  );

  if (projectError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-[14px] text-ink">{projectError.message}</p>
          <Button className="mt-4" variant="secondary" onClick={() => router.push(routes.projects)}>
            Back to projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <div className={chipClass}>
          <span className="text-[13px] font-medium text-ink">{projectName}</span>
          <StatusBadge tone="info">Overview</StatusBadge>
        </div>

        <CreateWorkspaceButton projectId={projectId} />
        <ArchiveProjectButton projectId={projectId} />

        <div className="pointer-events-auto flex h-8 items-center">
          <TeamPresence
            members={presenceMembers}
            activeInFor={activeIn}
            trailing={
              <AddMemberButton
                label="Add project members"
                open={addMembersOpen}
                onClick={() => {
                  setSelectedId(null);
                  setAddMembersOpen(true);
                }}
              />
            }
          />
        </div>
      </div>

      <ReactFlowProvider>
        <ProjectOverviewCanvas
          projectName={projectName}
          workspaces={workspaces}
          tool={tool}
          onSelect={selectWorkspace}
          onOpen={openWorkspace}
        />
      </ReactFlowProvider>

      <CanvasToolbar mode="overview" tool={tool} onTool={setTool} />

      {addMembersOpen ? (
        <AddMembersPanel
          title="Add project members"
          alreadyLabel="Already on project"
          emptyAvailableLabel="Everyone is already on this project"
          memberIds={projectMemberIds}
          onClose={() => setAddMembersOpen(false)}
          onSubmit={handleAddProjectMembers}
        />
      ) : null}

      {selectedWorkspace ? (
        <WorkspaceInspector
          key={selectedWorkspace.id}
          workspace={selectedWorkspace}
          projectName={projectName}
          onOpen={() => openWorkspace(selectedWorkspace.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
