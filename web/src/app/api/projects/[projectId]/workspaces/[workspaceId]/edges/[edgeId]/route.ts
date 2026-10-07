import { findSessionWorkspace } from "@/server/workspace";
import { clientIdFromRequest, publishEdgeRemoved } from "@/server/sync/publish";
import { deleteEdge, touchProject } from "@lyzyos/db";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ projectId: string; workspaceId: string; edgeId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const { projectId, workspaceId, edgeId } = await params;
  const { env, workspace } = await findSessionWorkspace({ projectId, workspaceId });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const result = await deleteEdge(env.DB, { edgeId, workspaceId: workspace.id });

  if (!result.success) {
    return NextResponse.json({ error: "Failed to delete edge" }, { status: 500 });
  }

  await touchProject(env.DB, projectId);
  await publishEdgeRemoved(env, workspace.id, edgeId, clientIdFromRequest(request));
  return NextResponse.json({ data: { ok: true } }, { status: 200 });
}
