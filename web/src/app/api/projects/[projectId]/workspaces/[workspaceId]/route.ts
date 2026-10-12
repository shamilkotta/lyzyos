import { loadAccessibleBoard, updateWorkspaceStatus, workspaceStatus } from "@lyzyos/db";
import { z } from "zod";
import { apiContext, clientIdFromRequest, HttpError, json, readJson, route } from "@/server/http";
import { publishSyncEvent } from "@/server/sync/publish";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

async function requireBoard(params: Params["params"]) {
  const [{ projectId, workspaceId }, { session, env }] = await Promise.all([params, apiContext()]);
  const board = await loadAccessibleBoard(env.DB, {
    projectId,
    workspaceId,
    userId: session.user.id,
  });
  if (!board) throw new HttpError(404, "Workspace not found");
  return { env, board };
}

export const GET = route<Params>(async (_request, { params }) => {
  const { board } = await requireBoard(params);
  return json(board);
});

const patchSchema = z.object({
  status: z.enum(workspaceStatus).optional(),
  statusNote: z.string().max(500).nullable().optional(),
  attention: z.string().max(500).nullable().optional(),
});

export const PATCH = route<Params>(async (request, { params }) => {
  const { env, board } = await requireBoard(params);
  const body = await readJson(request, patchSchema);

  const updated = await updateWorkspaceStatus(env.DB, board.workspace.id, body);
  if (!updated) throw new HttpError(500, "Update failed");

  await publishSyncEvent(
    env,
    updated.id,
    { type: "workspace.updated", workspace: updated },
    clientIdFromRequest(request),
  );
  return json(updated);
});
