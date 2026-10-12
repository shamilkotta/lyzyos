import "server-only";

import { getProjectWorkspaceByIdOrSlug } from "@lyzyos/db";
import { apiContext, HttpError } from "./http";

/** Resolves a workspace (by id or slug) the signed-in user can access, or throws 404. */
export async function requireWorkspace(args: { projectId: string; workspaceId: string }) {
  const { session, env } = await apiContext();
  const workspace = await getProjectWorkspaceByIdOrSlug(env.DB, args.workspaceId, {
    projectId: args.projectId,
    userId: session.user.id,
  });
  if (!workspace) throw new HttpError(404, "Workspace not found");
  return { session, env, workspace };
}
