"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { CaretLeft } from "@phosphor-icons/react";
import { CampaignCanvas } from "@/components/canvas/CampaignCanvas";
import { CanvasToolbar, type CanvasTool } from "./CanvasToolbar";
import { Inspector } from "./Inspector";
import { TeamPresence } from "./TeamPresence";
import { getDepartment, members, membersForDepartment, spaces } from "@/lib/data";
import { useDefaultWorkspace } from "@/lib/queries/projects";
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
  const { workspace } = useDefaultWorkspace(projectId ?? "", { enabled: Boolean(projectId) });
  const [boardMode, setBoardMode] = useState<BoardMode>("overview");
  const [departmentId, setDepartmentId] = useState<DepartmentId | undefined>();
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selection, setSelection] = useState<InspectorSelection>({ type: "none" });
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0];
  const department = departmentId ? getDepartment(departmentId) : undefined;
  const title = projectId ? projectName || "Project" : space.name;

  const workspaceId = workspace?.id;
  const openWorkspace = useCallback(() => {
    if (!projectId || !workspaceId) return;
    router.push(routes.projectWorkspace(projectId, workspaceId));
  }, [projectId, router, workspaceId]);

  const presenceMembers = useMemo(() => {
    if (boardMode === "branch" && departmentId) {
      return membersForDepartment(departmentId);
    }
    return members.filter((m) => m.status !== "away").slice(0, 8);
  }, [boardMode, departmentId]);

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

        {boardMode === "overview" ? (
          <p className="pointer-events-none hidden text-[12px] text-ink-tertiary lg:block">
            Double-click a department to enter
          </p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-10">
        <TeamPresence
          members={presenceMembers}
          onSelect={(member) => {
            setSelection({ type: "member", member });
            setInspectorOpen(true);
          }}
        />
      </div>

      <ReactFlowProvider>
        <CampaignCanvas
          mode={boardMode}
          departmentId={departmentId}
          tool={tool}
          apiProjectName={boardMode === "overview" && projectId ? title : undefined}
          workspaceLabel={workspace?.name}
          onOpenWorkspace={projectId && workspace?.id ? openWorkspace : undefined}
          onOpenDepartment={enterDepartment}
          onSelect={(next) => {
            setSelection(next);
            setInspectorOpen(next.type !== "none");
          }}
        />
      </ReactFlowProvider>

      <CanvasToolbar mode={boardMode} tool={tool} onTool={setTool} />

      <div className="pointer-events-none absolute inset-0 z-20">
        <Inspector
          open={inspectorOpen}
          selection={selection}
          mode={boardMode}
          departmentId={departmentId}
          onClose={() => {
            setInspectorOpen(false);
            setSelection({ type: "none" });
          }}
          onOpenDepartment={enterDepartment}
          onApplyFix={onApplyFix ?? (() => undefined)}
        />
      </div>
    </div>
  );
}
