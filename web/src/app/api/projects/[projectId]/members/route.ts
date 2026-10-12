import {
  addMembersToProject,
  getProjectMemberIds,
  getProjectRoster,
  userHasProjectAccess,
} from "@lyzyos/db";
import { z } from "zod";
import { apiContext, HttpError, json, readJson, route } from "@/server/http";

type Params = { params: Promise<{ projectId: string }> };

const addMembersSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

export const POST = route<Params>(async (request, { params }) => {
  const [{ projectId }, { session, env }] = await Promise.all([params, apiContext()]);

  // Workspace-only members may use their boards but cannot invite anyone to the project.
  const canManage = await userHasProjectAccess(env.DB, { projectId, userId: session.user.id });
  if (!canManage) throw new HttpError(403, "Project members only");

  const { userIds } = await readJson(request, addMembersSchema);
  await addMembersToProject(env.DB, { projectId, userIds });

  const [members, projectMemberIds] = await Promise.all([
    getProjectRoster(env.DB, { projectId }),
    getProjectMemberIds(env.DB, projectId),
  ]);
  return json({ members, projectMemberIds });
});
