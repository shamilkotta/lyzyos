import { NextResponse } from "next/server";
import { getAuth } from "@/server/auth";
import { getEnv } from "@/server/env";
import { getWorkspaceForUser } from "@lyzyos/db";
import { headers } from "next/headers";

type Params = { params: Promise<{ workspaceId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const env = await getEnv();

  const workspace = await getWorkspaceForUser(env.DB, workspaceId, session.user.id);
  if (!workspace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { token } = await auth.api.generateOneTimeToken({ headers: await headers() });

  return NextResponse.json({ token });
}
