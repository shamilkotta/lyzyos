import { getNodeInWorkspace, insertEdge, touchProject } from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { z } from "zod";
import { clientIdFromRequest, HttpError, json, readJson, route } from "@/server/http";
import { publishSyncEvent } from "@/server/sync/publish";
import { requireWorkspace } from "@/server/workspace";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const createEdgeSchema = z
  .object({
    sourceId: z.string().trim().min(1),
    targetId: z.string().trim().min(1),
  })
  .refine((data) => data.sourceId !== data.targetId, {
    path: ["targetId"],
    message: "Cannot connect a node to itself.",
  });

export const POST = route<Params>(async (request, { params }) => {
  const { projectId, workspaceId } = await params;
  const { env, workspace } = await requireWorkspace({ projectId, workspaceId });
  const { sourceId, targetId } = await readJson(request, createEdgeSchema);

  const [source, target] = await Promise.all([
    getNodeInWorkspace(env.DB, { nodeId: sourceId, workspaceId: workspace.id }),
    getNodeInWorkspace(env.DB, { nodeId: targetId, workspaceId: workspace.id }),
  ]);
  if (!source || !target) throw new HttpError(400, "Invalid node ids.");

  const [result, insertError] = await tryCatch(
    insertEdge(env.DB, { workspaceId: workspace.id, sourceId, targetId }),
  );
  // The only expected failure is the (source, target) unique index.
  const edge = result?.[0];
  if (insertError || !edge) throw new HttpError(409, "Edge already exists.");

  await Promise.all([
    touchProject(env.DB, projectId),
    publishSyncEvent(
      env,
      workspace.id,
      {
        type: "edge.upserted",
        edge: { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId },
      },
      clientIdFromRequest(request),
    ),
  ]);
  return json({ edge }, 201);
});
