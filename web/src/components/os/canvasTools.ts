import { ChatCircleText, Cursor, FileText, HandGrabbing, NoteBlank } from "@phosphor-icons/react";

export type CanvasTool = "select" | "hand" | "comment" | "note" | "doc";

type ToolDef = { id: CanvasTool; label: string; shortcut: string; icon: typeof Cursor };

const NAVIGATION_TOOLS: ToolDef[] = [
  { id: "select", label: "Select", shortcut: "s", icon: Cursor },
  { id: "hand", label: "Pan", shortcut: "p", icon: HandGrabbing },
];

export const PLACEMENT_TOOLS: ToolDef[] = [
  { id: "comment", label: "Comment", shortcut: "c", icon: ChatCircleText },
  { id: "note", label: "Note", shortcut: "n", icon: NoteBlank },
  { id: "doc", label: "Document", shortcut: "d", icon: FileText },
];

export const TOOLS = {
  overview: NAVIGATION_TOOLS,
  workspace: [...NAVIGATION_TOOLS, ...PLACEMENT_TOOLS],
} as const;

export function isPlacementTool(tool: CanvasTool) {
  return PLACEMENT_TOOLS.some((t) => t.id === tool);
}
