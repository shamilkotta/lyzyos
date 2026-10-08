import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { clientIdFromRequest, publishWorkspaceUpdated } from "@/server/sync/publish";
import { loadAccessibleBoard, updateWorkspaceStatus, workspaceStatus } from "@lyzyos/db";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId, workspaceId } = await params;
  const session = await requireSession();
  const env = await getEnv();

  const board = await loadAccessibleBoard(env.DB, {
    projectId,
    workspaceId,
    userId: session.user.id,
  });

  if (!board) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({ data: board }, { status: 200 });
}

const patchSchema = z.object({
  status: z.enum(workspaceStatus).optional(),
  statusNote: z.string().max(500).nullable().optional(),
  attention: z.string().max(500).nullable().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { projectId, workspaceId } = await params;
  const session = await requireSession();
  const env = await getEnv();

  const board = await loadAccessibleBoard(env.DB, {
    projectId,
    workspaceId,
    userId: session.user.id,
  });
  if (!board) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }

  const updated = await updateWorkspaceStatus(env.DB, board.workspace.id, body.data);
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await publishWorkspaceUpdated(env, updated, clientIdFromRequest(request));

  return NextResponse.json({ data: updated }, { status: 200 });
}
