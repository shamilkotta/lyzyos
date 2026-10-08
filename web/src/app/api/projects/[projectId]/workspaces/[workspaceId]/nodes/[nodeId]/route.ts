import { findSessionWorkspace } from "@/server/workspace";
import {
  clientIdFromRequest,
  publishNodeRemoved,
  publishNodeUpserted,
} from "@/server/sync/publish";
import { deleteNode, getNodeDto, getNodeInWorkspace, touchProject, updateNode } from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string; nodeId: string; workspaceId: string }> };

const updateNodeBodySchema = z
  .object({
    title: z.string().trim().optional(),
    data: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: Params) {
  const { projectId, nodeId, workspaceId } = await params;

  const { env, workspace } = await findSessionWorkspace({ projectId, workspaceId });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const currentNode = await getNodeInWorkspace(env.DB, { nodeId, workspaceId: workspace.id });

  if (!currentNode) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const [raw, jsonError] = await tryCatch(request.json());
  if (jsonError) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateNodeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const [updatedNode, error] = await tryCatch(updateNode(env.DB, { ...parsed.data, nodeId }));

  if (error) {
    return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
  }

  if (!updatedNode) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  await touchProject(env.DB, projectId);

  const node = await getNodeDto(env.DB, nodeId);
  if (node) {
    await publishNodeUpserted(env, workspace.id, node, clientIdFromRequest(request));
  }
  return NextResponse.json({ data: node }, { status: 200 });
}

export async function DELETE(request: Request, { params }: Params) {
  const { projectId, nodeId, workspaceId } = await params;
  const { env, workspace } = await findSessionWorkspace({ projectId, workspaceId });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const removed = await deleteNode(env.DB, { nodeId, workspaceId: workspace.id });
  if (!removed) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  if (removed.r2Keys.length > 0) {
    await tryCatch(env.FILES.delete(removed.r2Keys));
  }

  await touchProject(env.DB, projectId);
  await publishNodeRemoved(env, workspace.id, nodeId, clientIdFromRequest(request));
  return NextResponse.json({ data: { ok: true } }, { status: 200 });
}
