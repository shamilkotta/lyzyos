import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import {
  addMembersToWorkspace,
  getProjectWorkspace,
  getWorkspaceRoster,
  userHasProjectAccess,
} from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const addMembersSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

export async function POST(request: Request, { params }: Params) {
  const { projectId, workspaceId } = await params;
  const session = await requireSession();
  const env = await getEnv();

  // Workspace-only members may use the board but cannot invite anyone.
  const canManage = await userHasProjectAccess(env.DB, {
    projectId,
    userId: session.user.id,
  });
  if (!canManage) {
    return NextResponse.json({ error: "Project members only" }, { status: 403 });
  }

  const workspace = await getProjectWorkspace(env.DB, projectId, workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
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

  await addMembersToWorkspace(env.DB, {
    workspaceId: workspace.id,
    userIds: parsed.data.userIds,
  });

  const members = await getWorkspaceRoster(env.DB, {
    projectId,
    workspaceId: workspace.id,
  });

  return NextResponse.json({ data: { members } }, { status: 200 });
}
