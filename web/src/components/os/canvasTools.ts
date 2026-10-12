import {
  ChatCircleTextIcon,
  CursorIcon,
  FileTextIcon,
  HandGrabbingIcon,
  NoteBlankIcon,
} from "@phosphor-icons/react";

export type CanvasTool = "select" | "hand" | "comment" | "note" | "doc";

type ToolDef = { id: CanvasTool; label: string; shortcut: string; icon: typeof CursorIcon };

const NAVIGATION_TOOLS: ToolDef[] = [
  { id: "select", label: "Select", shortcut: "s", icon: CursorIcon },
  { id: "hand", label: "Pan", shortcut: "p", icon: HandGrabbingIcon },
];

export const PLACEMENT_TOOLS: ToolDef[] = [
  { id: "comment", label: "Comment", shortcut: "c", icon: ChatCircleTextIcon },
  { id: "note", label: "Note", shortcut: "n", icon: NoteBlankIcon },
  { id: "doc", label: "Document", shortcut: "d", icon: FileTextIcon },
];

export const TOOLS = {
  overview: NAVIGATION_TOOLS,
  workspace: [...NAVIGATION_TOOLS, ...PLACEMENT_TOOLS],
} as const;

export function isPlacementTool(tool: CanvasTool) {
  return PLACEMENT_TOOLS.some((t) => t.id === tool);
}
