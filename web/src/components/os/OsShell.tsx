"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { CaretLeft, CheckCircle } from "@phosphor-icons/react";
import { MenuBar } from "./MenuBar";
import { SpaceRail } from "./SpaceRail";
import { CanvasToolbar, type CanvasTool } from "./CanvasToolbar";
import { Inspector } from "./Inspector";
import { CommandPalette } from "./CommandPalette";
import { AttentionTray } from "./AttentionTray";
import { HomeDesktop } from "./HomeDesktop";
import { TeamPresence } from "./TeamPresence";
import { CampaignCanvas } from "@/components/canvas/CampaignCanvas";
import { PlanningWorkspace } from "@/components/planning/PlanningWorkspace";
import { attentionQueue, getDepartment, members, membersForDepartment, spaces } from "@/lib/data";
import { listProjects } from "@/lib/api";
import type { Project } from "@/lib/project-types";
import type { DepartmentId, InspectorSelection } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

type View = "home" | "campaign" | "planning";
type Rail = "home" | "spaces" | "knowledge" | "agents" | "settings";
type BoardMode = "overview" | "branch";

export function OsShell() {
  const [view, setView] = useState<View>("home");
  const [rail, setRail] = useState<Rail>("home");
  const [spaceId, setSpaceId] = useState("secureedge");
  const [boardMode, setBoardMode] = useState<BoardMode>("overview");
  const [departmentId, setDepartmentId] = useState<DepartmentId | undefined>();
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selection, setSelection] = useState<InspectorSelection>({ type: "none" });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [kickoffFocusToken, setKickoffFocusToken] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [liveProjects, setLiveProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string>("");

  const focusKickoff = useCallback(() => {
    setView("home");
    setRail("home");
    setKickoffFocusToken((n) => n + 1);
  }, []);

  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0];
  const liveProject = liveProjects.find((p) => p.id === activeProjectId);
  const department = departmentId ? getDepartment(departmentId) : undefined;

  const refreshLiveProjects = useCallback(async () => {
    try {
      const projects = await listProjects();
      setLiveProjects(projects);
    } catch {
      /* agent offline */
    }
  }, []);

  useEffect(() => {
    void refreshLiveProjects();
  }, [refreshLiveProjects]);

  useEffect(() => {
    if (view === "home") void refreshLiveProjects();
  }, [view, refreshLiveProjects]);

  useEffect(() => {
    if (liveProject?.name) setActiveProjectName(liveProject.name);
  }, [liveProject?.name]);

  // Lyzy renames Untitled projects during kickoff — poll until the title lands.
  useEffect(() => {
    if (!activeProjectId) return;
    if (liveProject?.name && liveProject.name !== "Untitled project") return;
    const t = window.setInterval(() => void refreshLiveProjects(), 2500);
    return () => window.clearInterval(t);
  }, [activeProjectId, liveProject?.name, refreshLiveProjects]);

  const presenceMembers = useMemo(() => {
    if (boardMode === "branch" && departmentId) {
      return membersForDepartment(departmentId);
    }
    return members.filter((m) => m.status !== "away").slice(0, 8);
  }, [boardMode, departmentId]);

  const openPlanning = useCallback(
    (projectId: string, projectName?: string) => {
      setActiveProjectId(projectId);
      setActiveProjectName(projectName ?? liveProjects.find((p) => p.id === projectId)?.name ?? "");
      setView("planning");
      setRail("spaces");
      setBoardMode("overview");
      setDepartmentId(undefined);
      setSelection({ type: "none" });
      setInspectorOpen(false);
      setAttentionOpen(false);
    },
    [liveProjects],
  );

  const openLiveProjectOverview = useCallback(
    (projectId: string, projectName?: string) => {
      setActiveProjectId(projectId);
      setActiveProjectName(projectName ?? liveProjects.find((p) => p.id === projectId)?.name ?? "");
      setView("campaign");
      setRail("spaces");
      setBoardMode("overview");
      setDepartmentId(undefined);
      setTool("select");
      setSelection({ type: "none" });
      setInspectorOpen(false);
      setAttentionOpen(false);
    },
    [liveProjects],
  );

  const openSpace = useCallback((id: string) => {
    setActiveProjectId(null);
    setSpaceId(id);
    setView("campaign");
    setRail("spaces");
    setBoardMode("overview");
    setDepartmentId(undefined);
    setTool("select");
    setSelection({ type: "none" });
    setInspectorOpen(false);
    setAttentionOpen(false);
  }, []);

  const openDepartment = useCallback((id: DepartmentId) => {
    setView("campaign");
    setBoardMode("branch");
    setDepartmentId(id);
    setTool("select");
    setSelection({ type: "none" });
    setInspectorOpen(false);
    setAttentionOpen(false);
  }, []);

  const backToProjectGraph = useCallback(() => {
    if (activeProjectId) {
      openLiveProjectOverview(activeProjectId, activeProjectName);
      return;
    }
    setView("campaign");
    setBoardMode("overview");
    setDepartmentId(undefined);
    setTool("select");
    setSelection({ type: "none" });
  }, [activeProjectId, activeProjectName, openLiveProjectOverview]);

  const enterDepartmentOrPlanning = useCallback(
    (id: DepartmentId) => {
      if (activeProjectId && id === "planning") {
        openPlanning(activeProjectId, activeProjectName);
        return;
      }
      openDepartment(id);
    },
    [activeProjectId, activeProjectName, openPlanning, openDepartment],
  );

  const backToOverview = useCallback(() => {
    setBoardMode("overview");
    setDepartmentId(undefined);
    setTool("select");
    setSelection({ type: "none" });
  }, []);

  const goHome = useCallback(() => {
    setView("home");
    setRail("home");
    setBoardMode("overview");
    setDepartmentId(undefined);
    setAttentionOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === "Escape" && view === "planning" && activeProjectId) {
        backToProjectGraph();
      }
      if (e.key === "Escape" && boardMode === "branch" && view === "campaign") {
        backToOverview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backToOverview, backToProjectGraph, boardMode, view, activeProjectId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const applyFix = () => {
    setToast("Suggestion applied · Compliance is re-checking the asset");
    setSelection({ type: "none" });
  };

  return (
    <div className="os-grain flex h-dvh flex-col bg-canvas text-ink">
      <MenuBar
        view={view}
        spaceName={
          activeProjectId
            ? activeProjectName || liveProject?.name
            : view === "campaign"
              ? space?.name
              : undefined
        }
        departmentName={view === "planning" ? undefined : department?.name}
        onHome={goHome}
        onCommand={() => setCommandOpen(true)}
        onToggleAttention={() => setAttentionOpen((v) => !v)}
        attentionCount={attentionQueue.length}
        onBackToOverview={
          view === "planning" || boardMode === "branch" ? backToProjectGraph : undefined
        }
      />

      <div className="relative flex min-h-0 flex-1">
        <SpaceRail
          active={rail}
          onChange={(id) => {
            setRail(id);
            if (id === "home" || id === "knowledge" || id === "agents" || id === "settings") {
              setView("home");
            }
            if (id === "spaces") {
              setView("campaign");
              setBoardMode("overview");
              setDepartmentId(undefined);
            }
          }}
          onNew={focusKickoff}
        />

        <main className="relative min-w-0 flex-1">
          {view === "home" ? (
            <HomeDesktop
              rail={rail}
              liveProjects={liveProjects}
              onOpenSpace={openSpace}
              onOpenLiveProject={(id, name) => {
                openLiveProjectOverview(id, name);
              }}
              onCreated={(projectId, projectName) => {
                void refreshLiveProjects();
                openLiveProjectOverview(projectId, projectName);
                setToast("Project created · open Planning from the graph");
              }}
              kickoffFocusToken={kickoffFocusToken}
            />
          ) : view === "planning" && activeProjectId ? (
            <PlanningWorkspace projectId={activeProjectId} onBack={backToProjectGraph} />
          ) : (
            <div className="relative h-full">
              <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
                {boardMode === "branch" ? (
                  <Button
                    variant="secondary"
                    className="pointer-events-auto h-8"
                    onClick={backToOverview}
                  >
                    <CaretLeft size={14} weight="bold" />
                    Campaign graph
                  </Button>
                ) : null}

                <div className="pointer-events-auto flex items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-3 py-1.5 backdrop-blur-md">
                  <span className="text-[13px] font-medium text-ink">
                    {boardMode === "overview"
                      ? activeProjectId
                        ? activeProjectName || liveProject?.name
                        : space.name
                      : (department?.name ?? "Department")}
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
                  label={boardMode === "branch" ? "In this room" : "On campaign"}
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
                  apiProjectName={
                    boardMode === "overview" && activeProjectId
                      ? activeProjectName || liveProject?.name
                      : undefined
                  }
                  onOpenPlanning={
                    activeProjectId
                      ? () => openPlanning(activeProjectId, activeProjectName)
                      : undefined
                  }
                  onOpenDepartment={enterDepartmentOrPlanning}
                  onSelect={(next) => {
                    setSelection(next);
                    setInspectorOpen(next.type !== "none");
                  }}
                />
              </ReactFlowProvider>

              <CanvasToolbar mode={boardMode} tool={tool} onTool={setTool} />

              {view === "campaign" ? (
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
                    onOpenDepartment={enterDepartmentOrPlanning}
                    onApplyFix={applyFix}
                  />
                </div>
              ) : null}
            </div>
          )}

          <AttentionTray
            open={attentionOpen}
            onClose={() => setAttentionOpen(false)}
            onSelect={(item) => {
              openSpace(item.campaignId);
              openDepartment(item.departmentId);
              setSelection({ type: "attention", item });
              setInspectorOpen(true);
              setAttentionOpen(false);
            }}
          />
        </main>
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onOpenCampaign={() => openSpace("secureedge")}
        onNewSpace={focusKickoff}
        onFocusAttention={() => setAttentionOpen(true)}
        onShowAgents={() => {
          setView("home");
          setRail("agents");
        }}
      />

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-ink shadow-[0_2px_8px_rgba(0,0,0,0.04)] fade-up">
          <CheckCircle size={15} weight="fill" className="text-pale-green-ink" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
