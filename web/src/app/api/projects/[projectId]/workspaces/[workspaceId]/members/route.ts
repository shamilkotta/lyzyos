import {
  addMembersToWorkspace,
  getProjectWorkspace,
  getWorkspaceRoster,
  userHasProjectAccess,
} from "@lyzyos/db";
import { z } from "zod";
import { apiContext, HttpError, json, readJson, route } from "@/server/http";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const addMembersSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

export const POST = route<Params>(async (request, { params }) => {
  const [{ projectId, workspaceId }, { session, env }] = await Promise.all([params, apiContext()]);

  // Workspace-only members may use the board but cannot invite anyone.
  const canManage = await userHasProjectAccess(env.DB, { projectId, userId: session.user.id });
  if (!canManage) throw new HttpError(403, "Project members only");

  const workspace = await getProjectWorkspace(env.DB, projectId, workspaceId);
  if (!workspace) throw new HttpError(404, "Workspace not found");

  const { userIds } = await readJson(request, addMembersSchema);
  await addMembersToWorkspace(env.DB, { workspaceId: workspace.id, userIds });

  const members = await getWorkspaceRoster(env.DB, { projectId, workspaceId: workspace.id });
  return json({ members });
});
