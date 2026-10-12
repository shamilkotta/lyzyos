import {
  archiveProject,
  getProjectForUser,
  getProjectMemberIds,
  getProjectRoster,
  unarchiveProject,
  userHasProjectAccess,
} from "@lyzyos/db";
import { z } from "zod";
import { apiContext, HttpError, json, readJson, route } from "@/server/http";

type Params = { params: Promise<{ projectId: string }> };

export const GET = route<Params>(async (_request, { params }) => {
  const [{ projectId }, { session, env }] = await Promise.all([params, apiContext()]);

  const project = await getProjectForUser(env.DB, projectId, session.user.id);
  if (!project) throw new HttpError(404, "Project not found");

  const [members, projectMemberIds] = await Promise.all([
    getProjectRoster(env.DB, { projectId }),
    getProjectMemberIds(env.DB, projectId),
  ]);
  return json({ ...project, members, projectMemberIds });
});

const patchSchema = z.object({ archived: z.boolean() });

export const PATCH = route<Params>(async (request, { params }) => {
  const [{ projectId }, { session, env }] = await Promise.all([params, apiContext()]);

  const isMember = await userHasProjectAccess(env.DB, { projectId, userId: session.user.id });
  if (!isMember) throw new HttpError(403, "Forbidden");

  const { archived } = await readJson(request, patchSchema);
  const updated = archived
    ? await archiveProject(env.DB, projectId)
    : await unarchiveProject(env.DB, projectId);
  if (!updated) throw new HttpError(404, "Project not found");

  return json(updated);
});
