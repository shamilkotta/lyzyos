"use client";

import { useCallback, useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { MenuBar } from "./MenuBar";
import { SpaceRail } from "./SpaceRail";
import { CanvasToolbar, type CanvasTool } from "./CanvasToolbar";
import { Inspector } from "./Inspector";
import { CommandPalette } from "./CommandPalette";
import { AttentionTray } from "./AttentionTray";
import { HomeDesktop } from "./HomeDesktop";
import { NewBriefModal } from "./NewBriefModal";
import { CampaignCanvas } from "@/components/canvas/CampaignCanvas";
import { attentionQueue, spaces } from "@/lib/data";
import type { InspectorSelection } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { CheckCircle } from "@phosphor-icons/react";

type View = "home" | "campaign";
type Rail = "home" | "spaces" | "knowledge" | "agents" | "settings";

export function OsShell() {
  const [view, setView] = useState<View>("home");
  const [rail, setRail] = useState<Rail>("home");
  const [spaceId, setSpaceId] = useState("secureedge");
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selection, setSelection] = useState<InspectorSelection>({ type: "none" });
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0];

  const openSpace = useCallback((id: string) => {
    setSpaceId(id);
    setView("campaign");
    setRail("spaces");
    setSelection({ type: "none" });
    setInspectorOpen(true);
    setAttentionOpen(false);
  }, []);

  const goHome = useCallback(() => {
    setView("home");
    setRail("home");
    setAttentionOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const applyFix = () => {
    setToast("Suggestion applied · Compliance Agent re-checking…");
    setSelection({ type: "none" });
  };

  return (
    <div className="os-grain flex h-dvh flex-col bg-canvas text-ink">
      <MenuBar
        view={view}
        spaceName={space?.name}
        onHome={goHome}
        onCommand={() => setCommandOpen(true)}
        onToggleAttention={() => setAttentionOpen((v) => !v)}
        attentionCount={attentionQueue.length}
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
            }
          }}
          onNew={() => setBriefOpen(true)}
        />

        <main className="relative min-w-0 flex-1">
          {view === "home" ? (
            <HomeDesktop
              rail={rail}
              onOpenSpace={openSpace}
              onNewSpace={() => setBriefOpen(true)}
            />
          ) : (
            <div className="relative h-full">
              <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
                <div className="pointer-events-auto flex items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-3 py-1.5 backdrop-blur-md">
                  <span className="text-[13px] font-medium text-ink">{space.name}</span>
                  <StatusBadge tone="warn">{space.stage}</StatusBadge>
                  <span className="font-mono text-[11px] text-ink-tertiary">{space.progress}%</span>
                </div>
                <Button
                  variant="secondary"
                  className="pointer-events-auto h-8"
                  onClick={() => {
                    setInspectorOpen(true);
                    setSelection({ type: "none" });
                  }}
                >
                  Campaign pulse
                </Button>
              </div>

              <ReactFlowProvider>
                <CampaignCanvas
                  tool={tool}
                  onSelect={(next) => {
                    setSelection(next);
                    if (next.type !== "none") setInspectorOpen(true);
                  }}
                />
              </ReactFlowProvider>

              <CanvasToolbar tool={tool} onTool={setTool} />
            </div>
          )}

          <AttentionTray
            open={attentionOpen}
            onClose={() => setAttentionOpen(false)}
            onSelect={(item) => {
              openSpace(item.campaignId);
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
            onClose={() => setInspectorOpen(false)}
            onApplyFix={applyFix}
          />
        ) : null}
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onOpenCampaign={() => openSpace("secureedge")}
        onNewSpace={() => setBriefOpen(true)}
        onFocusAttention={() => setAttentionOpen(true)}
        onShowAgents={() => {
          setView("home");
          setRail("agents");
        }}
      />

      <NewBriefModal
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        onCreated={() => {
          setBriefOpen(false);
          openSpace("secureedge");
          setToast("Campaign space created · agents are planning the board");
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
