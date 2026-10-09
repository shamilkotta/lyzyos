import { listArchivedProjectsForUser } from "@lyzyos/db";
import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await requireSession();
  const env = await getEnv();
  const archivedProjects = await listArchivedProjectsForUser(env.DB, session.user.id);
  return NextResponse.json({ data: archivedProjects }, { status: 200 });
}
