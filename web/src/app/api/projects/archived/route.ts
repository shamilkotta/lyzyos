import { listArchivedProjectsForUser } from "@lyzyos/db";
import { apiContext, json, route } from "@/server/http";

export const GET = route(async () => {
  const { session, env } = await apiContext();
  return json(await listArchivedProjectsForUser(env.DB, session.user.id));
});
