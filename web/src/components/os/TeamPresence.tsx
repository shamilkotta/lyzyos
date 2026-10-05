"use client";

import clsx from "clsx";
import type { Member } from "@/lib/types";

type Props = {
  members: Member[];
  onSelect?: (member: Member) => void;
  /** @deprecated Unused — kept for call-site compat. */
  label?: string;
};

export function TeamPresence({ members, onSelect }: Props) {
  if (members.length === 0) return null;

  return (
    <div className="pointer-events-auto flex items-center">
      {members.map((m, i) => (
        <button
          key={m.id}
          type="button"
          title={`${m.name} · ${m.role}${m.kind === "agent" ? " · Agent" : ""}`}
          onClick={() => onSelect?.(m)}
          className={clsx(
            "relative flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-surface text-[10px] font-medium text-ink shadow-sm transition-transform hover:z-10 hover:scale-105",
            m.kind === "agent" && "bg-pale-blue text-pale-blue-ink",
            i > 0 && "-ml-1.5",
          )}
        >
          {m.initials}
          <span
            className={clsx(
              "absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full ring-2 ring-canvas",
              m.status === "online" || m.status === "working" ? "bg-ink" : "bg-ink-tertiary",
            )}
          />
        </button>
      ))}
    </div>
  );
}
