import { notifyAgent } from "@/server/agent";
import { findSessionWorkspace } from "@/server/workspace";
import { clientIdFromRequest, publishNodeUpserted } from "@/server/sync/publish";
import { addCommentToThread, getNodeDto, getNodeInWorkspace, touchProject } from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const commentSchema = z.object({
  threadId: z.string().trim().nonempty(),
  message: z.string().trim().nonempty(),
});

export async function POST(req: Request, { params }: Params) {
  const { projectId, workspaceId } = await params;
  const [data, error] = await tryCatch(req.json());
  if (error) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const parsed = commentSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { session, env, workspace } = await findSessionWorkspace({ projectId, workspaceId });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { threadId, message } = parsed.data;
  const thread = await getNodeInWorkspace(env.DB, { nodeId: threadId, workspaceId: workspace.id });
  if (thread?.kind !== "comment") {
    return NextResponse.json({ error: "Comment thread not found" }, { status: 404 });
  }

  const [result, commentError] = await tryCatch(
    addCommentToThread(env.DB, {
      threadId,
      message,
      userId: session.user.id,
      workspaceId: workspace.id,
    }),
  );

  if (commentError) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  await touchProject(env.DB, projectId);

  const node = await getNodeDto(env.DB, threadId);
  if (!node) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  await publishNodeUpserted(env, workspace.id, node, clientIdFromRequest(req));

  notifyAgent(env, {
    projectId,
    threadId: parsed.data.threadId,
    workspaceId: workspace.id,
    message: [
      {
        id: result.id,
        role: "user",
        name: session.user.name,
        message: parsed.data.message,
      },
    ],
  });

  return NextResponse.json({ data: node }, { status: 200 });
}
