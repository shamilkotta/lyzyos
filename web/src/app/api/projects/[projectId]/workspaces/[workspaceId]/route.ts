import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { loadAccessibleBoard } from "@lyzyos/db";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId, workspaceId } = await params;
  const session = await requireSession();
  const env = await getEnv();

  const board = await loadAccessibleBoard(env.DB, {
    projectId,
    workspaceId,
    userId: session.user.id,
    agentId: env.AGENT_ID,
  });

  if (!board) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({ data: board }, { status: 200 });
}
