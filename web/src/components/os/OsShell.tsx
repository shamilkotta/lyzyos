"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MenuBar } from "./MenuBar";
import { SpaceRail } from "./SpaceRail";
import { CommandPalette } from "./CommandPalette";
import { AttentionTray } from "./AttentionTray";
import { attentionQueue } from "@/lib/data";
import { useProjects, useProjectBoard } from "@/lib/queries/projects";
import { railFromPathname, routeForRail, routes, type RailId } from "@/lib/routes";

type View = "home" | "campaign" | "workspace";

function viewFromPathname(pathname: string): View {
  if (/\/projects\/[^/]+\/workspaces\//.test(pathname)) return "workspace";
  if (pathname.startsWith("/projects/") || pathname.startsWith("/spaces/")) return "campaign";
  return "home";
}

function projectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

function workspaceIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/[^/]+\/workspaces\/([^/]+)/);
  return match?.[1] ?? null;
}

export function OsShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const view = viewFromPathname(pathname);
  const rail = railFromPathname(pathname);
  const activeProjectId = projectIdFromPathname(pathname);
  const activeWorkspaceId = workspaceIdFromPathname(pathname);

  const [commandOpen, setCommandOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);

  const { data: liveProjects = [] } = useProjects({
    refetchInterval: (query) => {
      if (!activeProjectId) return false;
      if (view !== "campaign" && view !== "workspace") return false;
      const project = query.state.data?.find((p) => p.id === activeProjectId);
      if (!project?.name || project.name === "Untitled project") return 2500;
      return false;
    },
  });

  const { data: workspaceBoard } = useProjectBoard(activeProjectId ?? "", {
    enabled: view === "workspace" && Boolean(activeProjectId) && Boolean(activeWorkspaceId),
    workspaceId: activeWorkspaceId,
  });

  const activeProjectName = liveProjects.find((p) => p.id === activeProjectId)?.name ?? "";
  const activeWorkspaceName = workspaceBoard?.workspace.name;
  const focusKickoff = useCallback(() => {
    router.push(routes.projects);
  }, [router]);

  const goHome = useCallback(() => {
    router.push(routes.projects);
  }, [router]);

  const backToProjectGraph = useCallback(() => {
    if (activeProjectId) {
      router.push(routes.project(activeProjectId));
    }
  }, [activeProjectId, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (e.key === "Escape" && view === "workspace" && activeProjectId) {
        backToProjectGraph();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeProjectId, backToProjectGraph, view]);

  const onRailChange = (id: RailId) => {
    router.push(routeForRail(id));
  };

  return (
    <div className="os-grain flex h-dvh flex-col bg-canvas text-ink">
      <MenuBar
        view={view}
        spaceName={activeProjectId ? activeProjectName || undefined : undefined}
        workspaceName={activeWorkspaceName}
        onHome={goHome}
        onCommand={() => setCommandOpen(true)}
        onToggleAttention={() => setAttentionOpen((v) => !v)}
        attentionCount={attentionQueue.length}
        onBackToOverview={view === "workspace" ? backToProjectGraph : undefined}
      />

      <div className="relative flex min-h-0 flex-1">
        <SpaceRail active={rail} onChange={onRailChange} onNew={focusKickoff} />
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>

      <AttentionTray
        open={attentionOpen}
        onClose={() => setAttentionOpen(false)}
        onSelect={(item) => {
          router.push(routes.space(item.campaignId));
          setAttentionOpen(false);
        }}
      />

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNewSpace={focusKickoff}
        onOpenCampaign={() => router.push(routes.space("secureedge"))}
        onShowAgents={() => router.push(routes.members)}
        onFocusAttention={() => setAttentionOpen(true)}
      />
    </div>
  );
}
