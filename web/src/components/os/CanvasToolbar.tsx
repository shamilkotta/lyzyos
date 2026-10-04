"use client";

import {
  Cursor,
  HandGrabbing,
  ChatCircleText,
  NoteBlank,
  WarningCircle,
  Robot,
  Cube,
  LinkSimple,
} from "@phosphor-icons/react";
import clsx from "clsx";

export type CanvasTool =
  | "select"
  | "hand"
  | "comment"
  | "note"
  | "blocker"
  | "agent"
  | "asset"
  | "connect";

type Props = {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
};

const tools: { id: CanvasTool; label: string; icon: typeof Cursor }[] = [
  { id: "select", label: "Select", icon: Cursor },
  { id: "hand", label: "Pan", icon: HandGrabbing },
  { id: "connect", label: "Connect", icon: LinkSimple },
  { id: "comment", label: "Comment", icon: ChatCircleText },
  { id: "note", label: "Note", icon: NoteBlank },
  { id: "blocker", label: "Blocker", icon: WarningCircle },
  { id: "agent", label: "Agent pin", icon: Robot },
  { id: "asset", label: "Asset", icon: Cube },
];

export function CanvasToolbar({ tool, onTool }: Props) {
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-[10px] border border-border bg-surface/95 p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
        {tools.map((item, index) => {
          const Icon = item.icon;
          const active = tool === item.id;
          const dividerBefore = item.id === "comment" || item.id === "agent";
          return (
            <div key={item.id} className="flex items-center">
              {dividerBefore ? <div className="mx-1 h-5 w-px bg-border" /> : null}
              <button
                type="button"
                title={item.label}
                onClick={() => onTool(item.id)}
                className={clsx(
                  "flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] transition-colors",
                  active
                    ? "bg-ink text-white"
                    : "text-ink-secondary hover:bg-surface-soft hover:text-ink",
                )}
                style={{ ["--index" as string]: index }}
              >
                <Icon size={14} weight="bold" />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
