"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTypingTarget } from "@/lib/dom";
import { useProject, useProjectBoard } from "@/lib/queries/projects";
import { parseProjectPath, RAIL_ROUTES, railFromPathname, routes } from "@/lib/routes";
import { CommandPalette } from "./CommandPalette";
import { MenuBar } from "./MenuBar";
import { SpaceRail } from "./SpaceRail";

export function OsShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { projectId, workspaceId } = parseProjectPath(pathname);
  const [commandOpen, setCommandOpen] = useState(false);

  // Shares cache entries with the project and workspace views, so these cost no extra requests.
  const { data: project } = useProject(projectId);
  const { data: board } = useProjectBoard(projectId, workspaceId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
      // Escape leaves a workspace — unless something else (a dialog, menu, or input) owns it.
      if (
        e.key === "Escape" &&
        projectId &&
        workspaceId &&
        !commandOpen &&
        !e.defaultPrevented &&
        !isTypingTarget(e.target)
      ) {
        router.push(routes.project(projectId));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, projectId, router, workspaceId]);

  return (
    <div className="os-grain flex h-dvh flex-col bg-canvas text-ink">
      <MenuBar
        projectName={project?.name}
        workspaceName={workspaceId ? (board?.workspace.name ?? "") : undefined}
        onBackToProject={projectId ? () => router.push(routes.project(projectId)) : undefined}
        onHome={() => router.push(routes.projects)}
        onCommand={() => setCommandOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1">
        <SpaceRail
          active={railFromPathname(pathname)}
          onChange={(rail) => router.push(RAIL_ROUTES[rail])}
          onNew={() => router.push(routes.projects)}
        />
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>

      {commandOpen ? <CommandPalette onClose={() => setCommandOpen(false)} /> : null}
    </div>
  );
}
