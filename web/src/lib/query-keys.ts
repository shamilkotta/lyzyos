export const queryKeys = {
  directory: ["directory"] as const,
  projects: {
    all: ["projects"] as const,
    archived: ["projects", "archived"] as const,
    detail: (projectId: string) => ["projects", projectId] as const,
    workspaces: (projectId: string) => ["projects", projectId, "workspaces"] as const,
    board: (projectId: string, workspaceId: string) =>
      ["projects", projectId, "board", workspaceId] as const,
    agentStatus: (projectId: string) => ["projects", projectId, "agent-status"] as const,
  },
};
