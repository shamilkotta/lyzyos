"use client";

import clsx from "clsx";
import type { Member } from "@/lib/types";

type Props = {
  members: Member[];
  onSelect?: (member: Member) => void;
  label?: string;
};

export function TeamPresence({ members, onSelect, label = "In this space" }: Props) {
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-[8px] border border-border bg-surface/95 px-2.5 py-1.5 backdrop-blur-md">
      <span className="hidden text-[11px] uppercase tracking-[0.05em] text-ink-tertiary sm:inline">
        {label}
      </span>
      <div className="flex items-center">
        {members.map((m, i) => (
          <button
            key={m.id}
            type="button"
            title={`${m.name} · ${m.role}${m.kind === "agent" ? " · Agent" : ""}`}
            onClick={() => onSelect?.(m)}
            className={clsx(
              "relative flex h-7 w-7 items-center justify-center rounded-full border border-surface text-[10px] font-medium transition-transform hover:z-10 hover:scale-105",
              m.kind === "agent" ? "bg-pale-blue text-pale-blue-ink" : "bg-canvas text-ink",
              i > 0 && "-ml-1.5",
            )}
          >
            {m.initials}
            <span
              className={clsx(
                "absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full ring-2 ring-surface",
                m.status === "working"
                  ? "bg-pale-green-ink"
                  : m.status === "online"
                    ? "bg-ink-tertiary"
                    : "bg-border-strong",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
