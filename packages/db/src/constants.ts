export const DEFAULT_WORKSPACES = {
  planning: {
    id: "planning",
    name: "Planning",
    kind: "planning",
  },
} as const;

/** Role given to agent accounts (Better Auth user.role). Humans get "user"/"admin"/null. */
export const AGENT_ROLE = "agent";

export function resolveAuthorKind(role?: string | null) {
  return role === AGENT_ROLE ? "agent" : "human";
}
