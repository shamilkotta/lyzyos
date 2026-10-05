"use client";

import { useEffect } from "react";
import {
  Cursor,
  HandGrabbing,
  ChatCircleText,
  NoteBlank,
  WarningCircle,
  ListChecks,
  Path,
  LinkSimple,
  FileText,
} from "@phosphor-icons/react";
import clsx from "clsx";

export type CanvasTool =
  | "select"
  | "hand"
  | "connect"
  | "comment"
  | "note"
  | "doc"
  | "instruction"
  | "work"
  | "blocker";

type ToolDef = {
  id: CanvasTool;
  label: string;
  shortcut: string;
  icon: typeof Cursor;
};

type Props = {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  /** Overview mode only needs navigation tools */
  mode: "overview" | "branch" | "planning";
};

const TOOL_SHORTCUTS: Record<CanvasTool, string> = {
  select: "s",
  hand: "p",
  connect: "l",
  comment: "c",
  note: "n",
  doc: "d",
  instruction: "i",
  work: "w",
  blocker: "b",
};

const branchTools: ToolDef[] = [
  { id: "select", label: "Select", shortcut: TOOL_SHORTCUTS.select, icon: Cursor },
  { id: "hand", label: "Pan", shortcut: TOOL_SHORTCUTS.hand, icon: HandGrabbing },
  { id: "connect", label: "Connect", shortcut: TOOL_SHORTCUTS.connect, icon: LinkSimple },
  { id: "comment", label: "Comment", shortcut: TOOL_SHORTCUTS.comment, icon: ChatCircleText },
  { id: "note", label: "Note", shortcut: TOOL_SHORTCUTS.note, icon: NoteBlank },
  { id: "instruction", label: "Instruction", shortcut: TOOL_SHORTCUTS.instruction, icon: Path },
  { id: "work", label: "Work", shortcut: TOOL_SHORTCUTS.work, icon: ListChecks },
  { id: "blocker", label: "Blocker", shortcut: TOOL_SHORTCUTS.blocker, icon: WarningCircle },
];

const overviewTools = branchTools.filter((t) => ["select", "hand"].includes(t.id));

const planningTools: ToolDef[] = [
  { id: "select", label: "Select", shortcut: TOOL_SHORTCUTS.select, icon: Cursor },
  { id: "hand", label: "Pan", shortcut: TOOL_SHORTCUTS.hand, icon: HandGrabbing },
  { id: "comment", label: "Comment", shortcut: TOOL_SHORTCUTS.comment, icon: ChatCircleText },
  { id: "note", label: "Note", shortcut: TOOL_SHORTCUTS.note, icon: NoteBlank },
  { id: "doc", label: "Document", shortcut: TOOL_SHORTCUTS.doc, icon: FileText },
];

function toolsForMode(mode: Props["mode"]): ToolDef[] {
  if (mode === "overview") return overviewTools;
  if (mode === "planning") return planningTools;
  return branchTools;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true'], input, textarea, select"));
}

export function CanvasToolbar({ tool, onTool, mode }: Props) {
  const tools = toolsForMode(mode);

  useEffect(() => {
    const available = toolsForMode(mode);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      const match = available.find((t) => t.shortcut === key);
      if (!match) return;

      e.preventDefault();
      onTool(match.id);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onTool]);

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-[10px] border border-border bg-surface/95 p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
        {tools.map((item) => {
          const Icon = item.icon;
          const active = tool === item.id;
          const dividerBefore = item.id === "comment";
          return (
            <div key={item.id} className="flex items-center">
              {dividerBefore ? <div className="mx-1 h-5 w-px bg-border" /> : null}
              <button
                type="button"
                title={`${item.label} (${item.shortcut.toUpperCase()})`}
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
