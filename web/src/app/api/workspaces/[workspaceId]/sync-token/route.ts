import { getWorkspaceForUser } from "@lyzyos/db";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth";
import { apiContext, HttpError, json, route } from "@/server/http";

type Params = { params: Promise<{ workspaceId: string }> };

/** One-time token the sync worker exchanges for the session when the websocket opens. */
export const POST = route<Params>(async (_request, { params }) => {
  const [{ workspaceId }, { session, env }] = await Promise.all([params, apiContext()]);

  const workspace = await getWorkspaceForUser(env.DB, workspaceId, session.user.id);
  if (!workspace) throw new HttpError(403, "Forbidden");

  const auth = await getAuth();
  const { token } = await auth.api.generateOneTimeToken({ headers: await headers() });
  return json({ token });
});
