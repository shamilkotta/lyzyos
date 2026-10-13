import { userCanSeeProject } from "@lyzyos/db";
import { getAgentWorking } from "@/server/agent";
import { apiContext, HttpError, json, route } from "@/server/http";

type Params = { params: Promise<{ projectId: string }> };

export const GET = route<Params>(async (_request, { params }) => {
  const [{ projectId }, { session, env }] = await Promise.all([params, apiContext()]);

  const hasAccess = await userCanSeeProject(env.DB, { projectId, userId: session.user.id });
  if (!hasAccess) throw new HttpError(403, "Forbidden");

  return json({ working: await getAgentWorking(env, projectId) });
});
