"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { isTypingTarget } from "@/lib/dom";
import { PLACEMENT_TOOLS, TOOLS, type CanvasTool } from "./canvasTools";

export type { CanvasTool };

type Props = {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  mode: keyof typeof TOOLS;
};

export function CanvasToolbar({ tool, onTool, mode }: Props) {
  const tools = TOOLS[mode];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const match = tools.find((t) => t.shortcut === e.key.toLowerCase());
      if (!match) return;
      e.preventDefault();
      onTool(match.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tools, onTool]);

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
      <div
        role="toolbar"
        aria-label="Canvas tools"
        className="pointer-events-auto flex items-center gap-0.5 rounded-[10px] border border-border bg-surface/95 p-1 shadow-[var(--shadow-soft)] backdrop-blur-md"
      >
        {tools.map((item) => {
          const Icon = item.icon;
          const active = tool === item.id;
          return (
            <div key={item.id} className="flex items-center">
              {item.id === PLACEMENT_TOOLS[0]!.id ? (
                <div className="mx-1 h-5 w-px bg-border" />
              ) : null}
              <button
                type="button"
                title={`${item.label} (${item.shortcut.toUpperCase()})`}
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => onTool(item.id)}
                className={clsx(
                  "flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] transition-colors",
                  active
                    ? "bg-ink text-white"
                    : "text-ink-secondary hover:bg-surface-soft hover:text-ink",
                )}
              >
                <Icon size={14} weight="bold" />
                <span className="hidden lg:inline">{item.label}</span>
                <kbd
                  className={clsx(
                    "hidden rounded px-1 font-mono text-[10px] uppercase sm:inline",
                    active ? "bg-white/15 text-white/80" : "bg-surface-soft text-ink-tertiary",
                  )}
                >
                  {item.shortcut}
                </kbd>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
