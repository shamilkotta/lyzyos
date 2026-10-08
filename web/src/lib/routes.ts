export const routes = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  projects: "/projects",
  project: (projectId: string) => `/projects/${projectId}`,
  projectWorkspace: (projectId: string, workspaceId: string) =>
    `/projects/${projectId}/workspaces/${workspaceId}`,
  space: (spaceId: string) => `/spaces/${spaceId}`,
  knowledge: "/knowledge",
  members: "/members",
  settings: "/settings",
} as const;

export type RailId = "home" | "spaces" | "knowledge" | "members" | "settings";

export function railFromPathname(pathname: string): RailId {
  if (pathname.startsWith("/knowledge")) return "knowledge";
  if (pathname.startsWith("/members")) return "members";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/projects/") || pathname.startsWith("/spaces/")) return "spaces";
  if (pathname === "/projects" || pathname === "/") return "home";
  return "home";
}

export function routeForRail(rail: RailId): string {
  switch (rail) {
    case "home":
      return routes.projects;
    case "spaces":
      return routes.space("secureedge");
    case "knowledge":
      return routes.knowledge;
    case "members":
      return routes.members;
    case "settings":
      return routes.settings;
  }
}
