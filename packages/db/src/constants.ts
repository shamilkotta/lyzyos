export const DEFAULT_WORKSPACES = {
  planning: {
    id: "planning",
    name: "Planning",
    kind: "planning",
  },
} as const;

export function resolveAuthorKind({ id, agentId }: { id?: string; agentId: string }) {
  return id === agentId ? "agent" : "human";
}
