import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import {
  createWorkspace,
  getProjectForUser,
  getWorkspaceRoster,
  listAccessibleWorkspaces,
} from "@lyzyos/db";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const session = await requireSession();
  const env = await getEnv();
  const rows = await listAccessibleWorkspaces(env.DB, {
    projectId,
    userId: session.user.id,
  });

  const data = await Promise.all(
    rows.map(async (workspace) => ({
      ...workspace,
      members: await getWorkspaceRoster(env.DB, {
        projectId,
        workspaceId: workspace.id,
      }),
    })),
  );

  return NextResponse.json({ data }, { status: 200 });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.string().trim().min(1).max(40).default("workspace"),
});

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const session = await requireSession();
  const env = await getEnv();

  const project = await getProjectForUser(env.DB, projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }

  const slug = body.data.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const workspace = await createWorkspace(env.DB, {
    projectId,
    name: body.data.name,
    kind: body.data.kind,
    slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`,
  });

  if (!workspace) {
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }

  const members = await getWorkspaceRoster(env.DB, { projectId, workspaceId: workspace.id });
  return NextResponse.json({ data: { ...workspace, members } }, { status: 201 });
}
