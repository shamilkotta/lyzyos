"use client";

import { House, SquaresFour, Books, Robot, GearSix, Plus } from "@phosphor-icons/react";
import clsx from "clsx";

type RailId = "home" | "spaces" | "knowledge" | "agents" | "settings";

type Props = {
  active: RailId;
  onChange: (id: RailId) => void;
  onNew: () => void;
};

const items: { id: RailId; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "spaces", label: "Spaces", icon: SquaresFour },
  { id: "knowledge", label: "Knowledge", icon: Books },
  { id: "agents", label: "Agents", icon: Robot },
  { id: "settings", label: "Settings", icon: GearSix },
];

export function SpaceRail({ active, onChange, onNew }: Props) {
  return (
    <aside className="relative z-20 flex w-[var(--rail-w)] shrink-0 flex-col items-center border-r border-border bg-surface py-3">
      <button
        type="button"
        onClick={onNew}
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-[8px] bg-ink text-white transition-transform active:scale-95"
        aria-label="New campaign space"
        title="New space"
      >
        <Plus size={16} weight="bold" />
      </button>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => onChange(item.id)}
              className={clsx(
                "flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors",
                isActive
                  ? "bg-surface-soft text-ink"
                  : "text-ink-tertiary hover:bg-surface-soft hover:text-ink",
              )}
            >
              <Icon size={18} weight={isActive ? "fill" : "bold"} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
