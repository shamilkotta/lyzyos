import { deleteEdge, touchProject } from "@lyzyos/db";
import { clientIdFromRequest, HttpError, json, route } from "@/server/http";
import { publishSyncEvent } from "@/server/sync/publish";
import { requireWorkspace } from "@/server/workspace";

type Params = { params: Promise<{ projectId: string; workspaceId: string; edgeId: string }> };

export const DELETE = route<Params>(async (request, { params }) => {
  const { projectId, workspaceId, edgeId } = await params;
  const { env, workspace } = await requireWorkspace({ projectId, workspaceId });

  const result = await deleteEdge(env.DB, { edgeId, workspaceId: workspace.id });
  if (!result.success) throw new HttpError(500, "Failed to delete edge");

  await Promise.all([
    touchProject(env.DB, projectId),
    publishSyncEvent(
      env,
      workspace.id,
      { type: "edge.removed", edgeId },
      clientIdFromRequest(request),
    ),
  ]);
  return json({ ok: true });
});
