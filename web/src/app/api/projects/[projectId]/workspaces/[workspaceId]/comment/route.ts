import { addCommentToThread, getNodeDto, getNodeInWorkspace, touchProject } from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { z } from "zod";
import { notifyAgent } from "@/server/agent";
import { getExecutionContext } from "@/server/env";
import { clientIdFromRequest, HttpError, json, readJson, route } from "@/server/http";
import { publishSyncEvent } from "@/server/sync/publish";
import { requireWorkspace } from "@/server/workspace";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const commentSchema = z.object({
  threadId: z.string().trim().nonempty(),
  message: z.string().trim().nonempty(),
});

export const POST = route<Params>(async (request, { params }) => {
  const { projectId, workspaceId } = await params;
  const [{ session, env, workspace }, ctx] = await Promise.all([
    requireWorkspace({ projectId, workspaceId }),
    getExecutionContext(),
  ]);
  const { threadId, message } = await readJson(request, commentSchema);

  const thread = await getNodeInWorkspace(env.DB, { nodeId: threadId, workspaceId: workspace.id });
  if (thread?.kind !== "comment") throw new HttpError(404, "Comment thread not found");

  const [result, commentError] = await tryCatch(
    addCommentToThread(env.DB, {
      threadId,
      message,
      userId: session.user.id,
      workspaceId: workspace.id,
    }),
  );
  if (commentError || !result) throw new HttpError(500, "Failed to add comment");

  const [node] = await Promise.all([getNodeDto(env.DB, threadId), touchProject(env.DB, projectId)]);
  if (!node) throw new HttpError(500, "Internal error");

  await publishSyncEvent(
    env,
    workspace.id,
    { type: "node.upserted", node },
    clientIdFromRequest(request),
  );

  notifyAgent(
    env,
    {
      projectId,
      threadId,
      workspaceId: workspace.id,
      message: [{ id: result.id, role: "user", name: session.user.name, message }],
    },
    ctx,
  );

  return json(node);
});
