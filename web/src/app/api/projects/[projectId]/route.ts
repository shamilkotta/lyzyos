import { getProjectForUser, getProjectMemberIds, getProjectRoster } from "@lyzyos/db";
import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { NextResponse } from "next/server";

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
