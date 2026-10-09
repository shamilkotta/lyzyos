import {
  archiveProject,
  getProjectForUser,
  getProjectMemberIds,
  getProjectRoster,
  unarchiveProject,
  userHasProjectAccess,
} from "@lyzyos/db";
import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchBodySchema = z.object({ archived: z.boolean() });

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;

  const session = await requireSession();
  const env = await getEnv();

  const project = await getProjectForUser(env.DB, projectId, session.user.id);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [members, projectMemberIds] = await Promise.all([
    getProjectRoster(env.DB, { projectId }),
    getProjectMemberIds(env.DB, projectId),
  ]);
  return NextResponse.json({ data: { ...project, members, projectMemberIds } }, { status: 200 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { projectId } = await params;

  const session = await requireSession();
  const env = await getEnv();

  const hasMembership = await userHasProjectAccess(env.DB, {
    projectId,
    userId: session.user.id,
  });
  if (!hasMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  const { archived } = parsed.data;
  const updated = archived
    ? await archiveProject(env.DB, projectId)
    : await unarchiveProject(env.DB, projectId);

  if (!updated) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  return NextResponse.json({ data: updated }, { status: 200 });
}
