import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { listAccessibleWorkspaces } from "@lyzyos/db";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const session = await requireSession();
  const env = await getEnv();
  const rows = await listAccessibleWorkspaces(env.DB, {
    projectId,
    userId: session.user.id,
  });

  return NextResponse.json({ data: rows }, { status: 200 });
}
