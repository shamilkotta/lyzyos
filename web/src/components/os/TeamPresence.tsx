"use client";

import clsx from "clsx";
import type { Member } from "@/lib/types";

type Props = {
  members: Member[];
  onSelect?: (member: Member) => void;
};

export function TeamPresence({ members, onSelect }: Props) {
  if (members.length === 0) return null;

  return (
    <div className="pointer-events-auto flex items-center">
      {members.map((m, i) => (
        <button
          key={m.id}
          type="button"
          title={`${m.name} · ${m.role}`}
          onClick={() => onSelect?.(m)}
          className={clsx(
            "relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-surface text-[10px] font-medium text-ink shadow-sm transition-transform hover:z-10 hover:scale-105",
            i > 0 && "-ml-1.5",
          )}
        >
          {m.image ? (
            // oxlint-disable-next-line next/no-img-element
            <img src={m.image} alt="" className="h-full w-full object-cover" />
          ) : (
            m.initials
          )}
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
