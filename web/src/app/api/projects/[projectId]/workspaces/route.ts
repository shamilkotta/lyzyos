import {
  createWorkspace,
  getProjectForUser,
  getWorkspaceRoster,
  listAccessibleWorkspaces,
} from "@lyzyos/db";
import { z } from "zod";
import { apiContext, HttpError, json, readJson, route } from "@/server/http";

type Params = { params: Promise<{ projectId: string }> };

export const GET = route<Params>(async (_request, { params }) => {
  const [{ projectId }, { session, env }] = await Promise.all([params, apiContext()]);
  const rows = await listAccessibleWorkspaces(env.DB, { projectId, userId: session.user.id });

  const data = await Promise.all(
    rows.map(async (workspace) => ({
      ...workspace,
      members: await getWorkspaceRoster(env.DB, { projectId, workspaceId: workspace.id }),
    })),
  );
  return json(data);
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.string().trim().min(1).max(40).default("workspace"),
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export const POST = route<Params>(async (request, { params }) => {
  const [{ projectId }, { session, env }] = await Promise.all([params, apiContext()]);

  const project = await getProjectForUser(env.DB, projectId, session.user.id);
  if (!project) throw new HttpError(404, "Project not found");

  const { name, kind } = await readJson(request, createSchema);
  const workspace = await createWorkspace(env.DB, {
    projectId,
    name,
    kind,
    slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`,
  });
  if (!workspace) throw new HttpError(500, "Failed to create workspace");

  const members = await getWorkspaceRoster(env.DB, { projectId, workspaceId: workspace.id });
  return json({ ...workspace, members }, 201);
});
