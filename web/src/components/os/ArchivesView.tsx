"use client";

import { Archive, ArrowCounterClockwise, CirclesFour, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useArchivedProjects, useUnarchiveProject } from "@/lib/queries/projects";
import { routes } from "@/lib/routes";

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

function formatDate(timestamp: number) {
  return dateFormat.format(timestamp);
}

function UnarchiveButton({ projectId }: { projectId: string }) {
  const { mutate, isPending } = useUnarchiveProject(projectId);
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.stopPropagation();
        mutate();
      }}
      className="flex items-center gap-1.5 rounded-[6px] border border-border px-2.5 py-1 text-[12px] text-ink-secondary transition-colors hover:border-border-strong hover:text-ink disabled:opacity-50"
    >
      <ArrowCounterClockwise size={12} />
      {isPending ? "Restoring…" : "Restore"}
    </button>
  );
}

export function ArchivesView() {
  const router = useRouter();
  const { data: projects = [], isLoading } = useArchivedProjects();

  return (
    <div className="relative h-full overflow-auto">
      <div className="relative z-10 mx-auto max-w-5xl px-8 py-12">
        <header className="mb-8 fade-up">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(routes.projects)}
              className="text-[13px] text-ink-tertiary hover:text-ink transition-colors"
            >
              ← Projects
            </button>
          </div>
          <h1 className="font-brand text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">
            Archives
          </h1>
          <p className="mt-2 text-[14px] text-ink-secondary">
            Archived projects are hidden from the home page. Restore them any time.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-tertiary">
            <SpinnerGap size={14} className="animate-spin" />
            Loading archived projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="fade-up flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-border px-8 py-16 text-center">
            <Archive size={32} className="text-ink-tertiary" />
            <p className="text-[14px] text-ink-secondary">No archived projects.</p>
          </div>
        ) : (
          <ul className="fade-up rounded-[12px] border border-border bg-surface">
            {projects.map((project) => (
              <li key={project.id} className="border-b border-border last:border-0">
                <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => router.push(routes.project(project.id))}
                    className="flex min-w-0 items-center gap-2.5 text-left"
                  >
                    <CirclesFour size={14} className="shrink-0 text-ink-tertiary" weight="bold" />
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {project.name}
                      </span>
                      {project.archivedAt ? (
                        <span className="text-[11px] text-ink-tertiary">
                          Archived {formatDate(project.archivedAt)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                  <UnarchiveButton projectId={project.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
