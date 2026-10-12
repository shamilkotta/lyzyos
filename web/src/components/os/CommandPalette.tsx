"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  CirclesFour,
  FilePlus,
  GearSix,
  MagnifyingGlass,
  Users,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useProjects } from "@/lib/queries/projects";
import { routes } from "@/lib/routes";

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: typeof FilePlus;
  href: string;
};

const STATIC_COMMANDS: Command[] = [
  {
    id: "new-project",
    label: "New project from brief",
    hint: "Create",
    icon: FilePlus,
    href: routes.projects,
  },
  {
    id: "members",
    label: "Open members directory",
    hint: "Members",
    icon: Users,
    href: routes.members,
  },
  {
    id: "archives",
    label: "Open archived projects",
    hint: "Archives",
    icon: Archive,
    href: routes.archives,
  },
  {
    id: "settings",
    label: "Open settings",
    hint: "Settings",
    icon: GearSix,
    href: routes.settings,
  },
];

/** Mounted only while open, so the query and listeners live exactly as long as the palette. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: projects = [] } = useProjects();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const projectCommands: Command[] = projects.map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      hint: "Project",
      icon: CirclesFour,
      href: routes.project(project.id),
    }));
    const needle = query.trim().toLowerCase();
    const all = [...STATIC_COMMANDS, ...projectCommands];
    return needle ? all.filter((c) => c.label.toLowerCase().includes(needle)) : all;
  }, [projects, query]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    router.push(command.href);
    onClose();
  };

  useEffect(() => {
    // Capture phase + preventDefault so the shell's own Escape handling stands down.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const selected = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-4 pt-[18vh] backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close command palette"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg overflow-hidden rounded-[12px] border border-border bg-surface shadow-[var(--shadow-soft)] fade-up"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <MagnifyingGlass size={16} className="text-ink-tertiary" weight="bold" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex(Math.min(selected + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex(Math.max(selected - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(filtered[selected]);
              }
            }}
            placeholder="Search projects or run a command…"
            className="h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-tertiary"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {filtered.map((cmd, index) => {
            const Icon = cmd.icon;
            const active = index === selected;
            return (
              <li key={cmd.id}>
                <button
                  type="button"
                  onClick={() => run(cmd)}
                  onMouseMove={() => setActiveIndex(index)}
                  aria-current={active ? "true" : undefined}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2.5 text-left transition-colors",
                    active && "bg-surface-soft",
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-canvas text-ink">
                    <Icon size={15} weight="bold" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {cmd.label}
                    </span>
                    <span className="block text-[12px] text-ink-tertiary">{cmd.hint}</span>
                  </span>
                  <ArrowRight size={14} className="text-ink-tertiary" />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-ink-secondary">
              No matching projects or commands
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
