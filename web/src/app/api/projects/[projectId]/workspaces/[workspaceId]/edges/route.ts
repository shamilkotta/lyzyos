import { findSessionWorkspace } from "@/server/workspace";
import { clientIdFromRequest, publishEdgeUpserted } from "@/server/sync/publish";
import { getNodeInWorkspace, insertEdge, touchProject } from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const createEdgeBodySchema = z
  .object({
    sourceId: z.string().trim().min(1),
    targetId: z.string().trim().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.sourceId === data.targetId) {
      ctx.addIssue({
        path: ["targetId"],
        code: "invalid_value",
        message: "Cannot connect a node to itself.",
        values: [data.sourceId, data.targetId],
      });
    }
  });

export async function POST(request: Request, { params }: Params) {
  const { projectId, workspaceId } = await params;
  const [data, bodyError] = await tryCatch(request.json());
  if (bodyError) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createEdgeBodySchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { env, workspace } = await findSessionWorkspace({ projectId, workspaceId });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const source = await getNodeInWorkspace(env.DB, {
    nodeId: parsed.data.sourceId,
    workspaceId: workspace.id,
  });
  const target = await getNodeInWorkspace(env.DB, {
    nodeId: parsed.data.targetId,
    workspaceId: workspace.id,
  });
  if (!source || !target) {
    return NextResponse.json({ error: "Invalid node ids." }, { status: 400 });
  }

  const [result, insertError] = await tryCatch(
    insertEdge(env.DB, {
      workspaceId: workspace.id,
      sourceId: parsed.data.sourceId,
      targetId: parsed.data.targetId,
    }),
  );
  // The only expected failure is the (source, target) unique index.
  const edge = result?.[0];
  if (insertError || !edge) {
    return NextResponse.json({ error: "Edge already exists." }, { status: 409 });
  }

  await touchProject(env.DB, projectId);
  await publishEdgeUpserted(
    env,
    workspace.id,
    { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId },
    clientIdFromRequest(request),
  );
  return NextResponse.json({ data: { edge } }, { status: 201 });
}
