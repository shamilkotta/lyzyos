import "server-only";

import { getProjectWorkspaceByIdOrSlug } from "@lyzyos/db";
import { getEnv } from "./env";
import { requireSession } from "./session";

export async function findSessionWorkspace(args: { projectId: string; workspaceId: string }) {
  const session = await requireSession();
  const env = await getEnv();
  const workspace = await getProjectWorkspaceByIdOrSlug(env.DB, args.workspaceId, {
    projectId: args.projectId,
    userId: session.user.id,
  });
  return { session, env, workspace };
}
