import { deleteNode, getNodeDto, getNodeInWorkspace, touchProject, updateNode } from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { z } from "zod";
import { clientIdFromRequest, HttpError, json, readJson, route } from "@/server/http";
import { publishSyncEvent } from "@/server/sync/publish";
import { requireWorkspace } from "@/server/workspace";

type Params = { params: Promise<{ projectId: string; nodeId: string; workspaceId: string }> };

const updateNodeSchema = z
  .object({
    title: z.string().trim().optional(),
    data: z.string().optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
  })
  .strict();

export const PATCH = route<Params>(async (request, { params }) => {
  const { projectId, nodeId, workspaceId } = await params;
  const { env, workspace } = await requireWorkspace({ projectId, workspaceId });

  const currentNode = await getNodeInWorkspace(env.DB, { nodeId, workspaceId: workspace.id });
  if (!currentNode) throw new HttpError(404, "Node not found");

  const body = await readJson(request, updateNodeSchema);
  const [updatedNode, error] = await tryCatch(updateNode(env.DB, { ...body, nodeId }));
  if (error) throw new HttpError(500, "Failed to update node");
  if (!updatedNode) throw new HttpError(404, "Node not found");

  const [node] = await Promise.all([getNodeDto(env.DB, nodeId), touchProject(env.DB, projectId)]);
  if (node) {
    await publishSyncEvent(
      env,
      workspace.id,
      { type: "node.upserted", node },
      clientIdFromRequest(request),
    );
  }
  return json(node);
});

export const DELETE = route<Params>(async (request, { params }) => {
  const { projectId, nodeId, workspaceId } = await params;
  const { env, workspace } = await requireWorkspace({ projectId, workspaceId });

  const removed = await deleteNode(env.DB, { nodeId, workspaceId: workspace.id });
  if (!removed) throw new HttpError(404, "Node not found");

  await Promise.all([
    removed.r2Keys.length > 0 ? tryCatch(env.FILES.delete(removed.r2Keys)) : null,
    touchProject(env.DB, projectId),
    publishSyncEvent(
      env,
      workspace.id,
      { type: "node.removed", nodeId },
      clientIdFromRequest(request),
    ),
  ]);
  return json({ ok: true });
});
