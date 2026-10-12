export const routes = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  projects: "/projects",
  archives: "/projects/archives",
  project: (projectId: string) => `/projects/${projectId}`,
  projectWorkspace: (projectId: string, workspaceId: string) =>
    `/projects/${projectId}/workspaces/${workspaceId}`,
  members: "/members",
  settings: "/settings",
} as const;

export type RailId = "home" | "members" | "settings";

export const RAIL_ROUTES: Record<RailId, string> = {
  home: routes.projects,
  members: routes.members,
  settings: routes.settings,
};

export function railFromPathname(pathname: string): RailId {
  if (pathname.startsWith(routes.members)) return "members";
  if (pathname.startsWith(routes.settings)) return "settings";
  return "home";
}

/** Splits an OS pathname into the project/workspace it addresses, if any. */
export function parseProjectPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/workspaces\/([^/]+))?/);
  const projectId = match?.[1];
  // `/projects/archives` is a listing, not a project.
  if (!projectId || projectId === "archives") return { projectId: null, workspaceId: null };
  return { projectId, workspaceId: match?.[2] ?? null };
}
