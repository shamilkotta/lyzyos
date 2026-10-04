"use client";

import { MagnifyingGlass, Bell, CirclesFour, CaretRight } from "@phosphor-icons/react";
import { PRODUCT_NAME } from "@/lib/data";
import clsx from "clsx";

type Props = {
  spaceName?: string;
  onCommand: () => void;
  onToggleAttention: () => void;
  attentionCount: number;
  view: "home" | "campaign";
  onHome: () => void;
};

export function MenuBar({
  spaceName,
  onCommand,
  onToggleAttention,
  attentionCount,
  view,
  onHome,
}: Props) {
  return (
    <header className="relative z-20 flex h-[var(--menubar-h)] shrink-0 items-center justify-between border-b border-border bg-surface/90 px-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-surface-soft"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-ink text-white">
            <CirclesFour size={13} weight="bold" />
          </span>
          <span className="text-[13px] font-medium tracking-[-0.01em] text-ink">
            {PRODUCT_NAME}
          </span>
        </button>

        {view === "campaign" && spaceName ? (
          <>
            <CaretRight size={12} className="text-ink-tertiary" />
            <span className="truncate text-[13px] text-ink-secondary">{spaceName}</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCommand}
          className={clsx(
            "flex h-8 items-center gap-2 rounded-[6px] border border-border bg-canvas px-2.5 text-[12px] text-ink-secondary transition-colors hover:border-border-strong hover:text-ink",
          )}
        >
          <MagnifyingGlass size={14} weight="bold" />
          <span className="hidden sm:inline">Search or run</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={onToggleAttention}
          className="relative flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
          aria-label="Needs attention"
        >
          <Bell size={16} weight="bold" />
          {attentionCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-pale-red-ink px-1 text-[9px] font-medium text-white">
              {attentionCount}
            </span>
          ) : null}
        </button>

        <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-pale-blue text-[11px] font-medium text-pale-blue-ink">
          MK
        </div>
      </div>
    </header>
  );
}
