import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import {
  addMembersToProject,
  getProjectForUser,
  getProjectMemberIds,
  getProjectRoster,
  userHasProjectAccess,
} from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string }> };

const addMembersSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const session = await requireSession();
  const env = await getEnv();

  const canManage = await userHasProjectAccess(env.DB, {
    projectId,
    userId: session.user.id,
  });
  if (!canManage) {
    return NextResponse.json({ error: "Project members only" }, { status: 403 });
  }

  const project = await getProjectForUser(env.DB, projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [raw, jsonError] = await tryCatch(request.json());
  if (jsonError) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addMembersSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  await addMembersToProject(env.DB, {
    projectId,
    userIds: parsed.data.userIds,
  });

  const [members, projectMemberIds] = await Promise.all([
    getProjectRoster(env.DB, { projectId }),
    getProjectMemberIds(env.DB, projectId),
  ]);

  return NextResponse.json({ data: { members, projectMemberIds } }, { status: 200 });
}
