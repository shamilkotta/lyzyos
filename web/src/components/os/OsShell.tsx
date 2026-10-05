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
import { attentionQueue, getDepartment, members, membersForDepartment, spaces } from "@/lib/data";
import type { DepartmentId, InspectorSelection } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

type View = "home" | "campaign";
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
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [kickoffFocusToken, setKickoffFocusToken] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const focusKickoff = useCallback(() => {
    setView("home");
    setRail("home");
    setKickoffFocusToken((n) => n + 1);
  }, []);

  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0];
  const department = departmentId ? getDepartment(departmentId) : undefined;

  const presenceMembers = useMemo(() => {
    if (boardMode === "branch" && departmentId) {
      return membersForDepartment(departmentId);
    }
    return members.filter((m) => m.status !== "away").slice(0, 8);
  }, [boardMode, departmentId]);

  const openSpace = useCallback((id: string) => {
    setSpaceId(id);
    setView("campaign");
    setRail("spaces");
    setBoardMode("overview");
    setDepartmentId(undefined);
    setTool("select");
    setSelection({ type: "none" });
    setInspectorOpen(true);
    setAttentionOpen(false);
  }, []);

  const openDepartment = useCallback((id: DepartmentId) => {
    setBoardMode("branch");
    setDepartmentId(id);
    setTool("select");
    setSelection({ type: "none" });
    setInspectorOpen(true);
    setAttentionOpen(false);
  }, []);

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
      if (e.key === "Escape" && boardMode === "branch" && view === "campaign") {
        backToOverview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backToOverview, boardMode, view]);

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
        spaceName={space?.name}
        departmentName={department?.name}
        onHome={goHome}
        onCommand={() => setCommandOpen(true)}
        onToggleAttention={() => setAttentionOpen((v) => !v)}
        attentionCount={attentionQueue.length}
        onBackToOverview={boardMode === "branch" ? backToOverview : undefined}
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
              onOpenSpace={openSpace}
              onCreated={() => {
                openSpace("secureedge");
                setToast("Campaign space created · departments are on the graph");
              }}
              kickoffFocusToken={kickoffFocusToken}
            />
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
                    {boardMode === "overview" ? space.name : (department?.name ?? "Department")}
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
                  onOpenDepartment={openDepartment}
                  onSelect={(next) => {
                    setSelection(next);
                    if (next.type !== "none") setInspectorOpen(true);
                  }}
                />
              </ReactFlowProvider>

              <CanvasToolbar mode={boardMode} tool={tool} onTool={setTool} />
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

        {view === "campaign" ? (
          <Inspector
            open={inspectorOpen}
            selection={selection}
            mode={boardMode}
            departmentId={departmentId}
            onClose={() => setInspectorOpen(false)}
            onOpenDepartment={openDepartment}
            onApplyFix={applyFix}
          />
        ) : null}
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
