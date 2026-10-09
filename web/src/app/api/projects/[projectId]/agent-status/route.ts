import { userHasProjectAccess } from "@lyzyos/db";
import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;

  const session = await requireSession();
  const env = await getEnv();

  const hasAccess = await userHasProjectAccess(env.DB, {
    projectId,
    userId: session.user.id,
  });
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!env.AGENT) return NextResponse.json({ working: false });

  const url = new URL("https://agent/status");
  url.searchParams.set("projectId", projectId);

  const res = await env.AGENT.fetch(
    new Request(url.toString(), {
      headers: { "X-Internal-Secret": env.INTERNAL_SECRET },
    }),
  );

  if (!res.ok) return NextResponse.json({ working: false });

  const data = (await res.json()) as { working: boolean };
  return NextResponse.json({ working: data.working ?? false });
}
