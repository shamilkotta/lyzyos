"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MagnifyingGlass,
  ArrowRight,
  FilePlus,
  SquaresFour,
  WarningCircle,
  Robot,
} from "@phosphor-icons/react";
import clsx from "clsx";

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: typeof FilePlus;
  action: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenCampaign: () => void;
  onNewSpace: () => void;
  onFocusAttention: () => void;
  onShowAgents: () => void;
};

export function CommandPalette({
  open,
  onClose,
  onOpenCampaign,
  onNewSpace,
  onFocusAttention,
  onShowAgents,
}: Props) {
  const [query, setQuery] = useState("");

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "open-secureedge",
        label: "Open SecureEdge workspace",
        hint: "Campaign board",
        icon: SquaresFour,
        action: onOpenCampaign,
      },
      {
        id: "new-space",
        label: "New campaign from brief",
        hint: "Create",
        icon: FilePlus,
        action: onNewSpace,
      },
      {
        id: "attention",
        label: "Show what needs my decision",
        hint: "Attention",
        icon: WarningCircle,
        action: onFocusAttention,
      },
      {
        id: "agents",
        label: "Inspect active agents",
        hint: "Agents",
        icon: Robot,
        action: onShowAgents,
      },
    ],
    [onFocusAttention, onNewSpace, onOpenCampaign, onShowAgents],
  );

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  const closePalette = () => {
    setQuery("");
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        onClose();
      }
      if (e.key === "Escape") {
        setQuery("");
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-4 pt-[18vh] backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close command palette"
        onClick={closePalette}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] fade-up">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <MagnifyingGlass size={16} className="text-ink-tertiary" weight="bold" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spaces, agents, or run a command…"
            className="h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-tertiary"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {filtered.map((cmd, index) => {
            const Icon = cmd.icon;
            return (
              <li key={cmd.id}>
                <button
                  type="button"
                  onClick={() => {
                    cmd.action();
                    closePalette();
                  }}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2.5 text-left transition-colors hover:bg-surface-soft",
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-canvas text-ink">
                    <Icon size={15} weight="bold" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{cmd.label}</span>
                    <span className="block text-[12px] text-ink-tertiary">{cmd.hint}</span>
                  </span>
                  <ArrowRight size={14} className="text-ink-tertiary" />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-ink-secondary">
              No matching commands
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
