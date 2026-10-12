"use client";

import {
  Archive,
  CirclesFour,
  DotOutline,
  SpinnerGap,
  ArrowRight,
  Clock,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PRODUCT_NAME } from "@/lib/constants";
import { formatRelative, formatShortDate } from "@/lib/format";
import { useProjects } from "@/lib/queries/projects";
import { routes } from "@/lib/routes";
import { projectStatusLabel, projectStatusTone } from "@/lib/status";
import { KickoffComposer } from "./KickoffComposer";

const RECENT_PROJECT_COUNT = 3;
const LIST_PROJECT_COUNT = 8;

export function HomeDesktop() {
  const router = useRouter();
  const { data: liveProjects = [], isLoading, isFetching } = useProjects();
  // The API returns projects most recently updated first.
  const recentProjects = liveProjects.slice(0, RECENT_PROJECT_COUNT);
  const completeCount = liveProjects.filter((p) => p.status !== "in_progress").length;
  const progress = liveProjects.length
    ? Math.round((completeCount / liveProjects.length) * 100)
    : 0;

  return (
    <div className="relative h-full overflow-auto">
      <div className="ambient-blob left-[10%] top-[8%]" />
      <div
        className="ambient-blob right-[-10%] bottom-[-20%]"
        style={{
          background: "radial-gradient(circle, rgba(251,243,219,0.65) 0%, rgba(247,246,243,0) 70%)",
          animationDelay: "-10s",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-8 py-12">
        <header className="mb-6 fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-tertiary">
            Marketing operations desk
          </p>
          <h1 className="mt-2 font-brand text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] text-ink">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
            Open a campaign graph. Departments are rooms. Teammates work inside those rooms together
            — comments, notes, assets, decisions.
          </p>
        </header>

        <div className="mb-10">
          <KickoffComposer
            onOpen={(projectId, workspaceId) =>
              router.push(routes.projectWorkspace(projectId, workspaceId))
            }
          />
        </div>

        {isLoading ? (
          <div className="mb-10 flex items-center gap-2 text-[13px] text-ink-tertiary">
            <SpinnerGap size={14} className="animate-spin" />
            Loading projects…
          </div>
        ) : null}

        {!isLoading ? (
          <section className="mb-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
                Recent
              </h2>
              <span className="font-mono text-[11px] text-ink-tertiary">
                {liveProjects.length} {liveProjects.length === 1 ? "project" : "projects"}
                {isFetching ? " · refreshing" : ""}
              </span>
            </div>
            {recentProjects.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-ink-tertiary">
                No projects yet. Start one with a brief above.
              </p>
            ) : (
              <div className="stagger grid gap-3 md:grid-cols-3">
                {recentProjects.map((project, index) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => router.push(routes.project(project.id))}
                    className={clsx(
                      "group rounded-[12px] border border-border bg-surface p-4 text-left transition-[box-shadow,border-color,transform] duration-200",
                      "hover:border-border-strong hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99]",
                    )}
                    style={{ ["--index" as string]: index }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-canvas text-ink">
                        <CirclesFour size={15} weight="bold" />
                      </span>
                      <StatusBadge tone={projectStatusTone(project.status)}>
                        {projectStatusLabel(project.status)}
                      </StatusBadge>
                    </div>

                    <SpacePreview panes={["bg-surface", "bg-pale-yellow/80", "bg-pale-blue/70"]} />

                    <h3 className="truncate text-[14px] font-medium tracking-[-0.01em] text-ink">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-[12px] text-ink-secondary">
                      Updated {formatRelative(project.updatedAt)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[12px] text-ink-tertiary">
                      <span>Created</span>
                      <span className="font-mono">{formatShortDate(project.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {!isLoading && liveProjects.length > 0 ? (
          <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
                  All projects
                </h2>
                <button
                  type="button"
                  onClick={() => router.push(routes.archives)}
                  className="flex items-center gap-1.5 text-[11px] text-ink-tertiary transition-colors hover:text-ink"
                >
                  <Archive size={12} />
                  Archives
                </button>
              </div>
              <ul className="rounded-[12px] border border-border bg-surface">
                {liveProjects.slice(0, LIST_PROJECT_COUNT).map((project) => (
                  <li key={project.id} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => router.push(routes.project(project.id))}
                      className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-soft"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CirclesFour
                          size={14}
                          className="shrink-0 text-ink-tertiary"
                          weight="bold"
                        />
                        <span className="truncate text-[13px] font-medium text-ink">
                          {project.name}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                          <Clock size={11} />
                          {formatRelative(project.updatedAt)}
                        </span>
                        <StatusBadge tone={projectStatusTone(project.status)}>
                          {projectStatusLabel(project.status)}
                        </StatusBadge>
                        <ArrowRight
                          size={12}
                          className="text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {liveProjects.length > LIST_PROJECT_COUNT ? (
                <p className="mt-2 text-center text-[12px] text-ink-tertiary">
                  +{liveProjects.length - LIST_PROJECT_COUNT} more projects
                </p>
              ) : null}
            </div>

            <div>
              <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-tertiary">
                Overview
              </h2>
              <div className="rounded-[12px] border border-border bg-surface p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-ink-secondary">Total projects</span>
                    <span className="font-mono text-[20px] font-semibold text-ink">
                      {liveProjects.length}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-ink-secondary">In progress</span>
                    <span className="font-mono text-[20px] font-semibold text-ink">
                      {liveProjects.length - completeCount}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-ink-secondary">Complete</span>
                    <span className="font-mono text-[20px] font-semibold text-ink">
                      {completeCount}
                    </span>
                  </div>
                </div>

                {liveProjects.length > 0 ? (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] text-ink-tertiary">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-full rounded-full bg-ink transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SpacePreview({ panes }: { panes: [string, string, string] }) {
  return (
    <div className="mb-3 overflow-hidden rounded-[8px] border border-border bg-canvas">
      <div className="flex h-6 items-center gap-1 border-b border-border bg-surface px-2">
        <DotOutline size={14} weight="fill" className="text-border-strong" />
        <DotOutline size={14} weight="fill" className="text-border-strong" />
        <DotOutline size={14} weight="fill" className="text-border-strong" />
      </div>
      <div className="grid h-20 grid-cols-3 gap-1.5 p-2">
        {panes.map((pane) => (
          <div key={pane} className={clsx("rounded-[4px] border border-border", pane)} />
        ))}
      </div>
    </div>
  );
}
