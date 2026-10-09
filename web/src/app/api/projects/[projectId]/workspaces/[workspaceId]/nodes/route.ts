import { notifyAgent } from "@/server/agent";
import { getExecutionContext } from "@/server/env";
import { findSessionWorkspace } from "@/server/workspace";
import { clientIdFromRequest, publishNodeUpserted } from "@/server/sync/publish";
import {
  createCommentNode,
  createDocumentNode,
  createNoteNode,
  docKey,
  getNodeDto,
  putObject,
  touchProject,
} from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const positionFields = {
  title: z.string().trim().optional(),
  x: z.coerce.number(),
  y: z.coerce.number(),
};

const createNodeBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("note"),
    data: z.string().trim().default(""),
    ...positionFields,
  }),
  z.object({
    kind: z.literal("comment"),
    data: z.string().trim().default(""),
    ...positionFields,
  }),
  z.object({
    kind: z.literal("doc"),
    file: z.file(),
    ...positionFields,
  }),
]);

export async function POST(request: Request, { params }: Params) {
  const { projectId, workspaceId } = await params;

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const [{ session, env, workspace: userWorkspace }, ctx] = await Promise.all([
    findSessionWorkspace({ projectId, workspaceId }),
    getExecutionContext(),
  ]);
  if (!userWorkspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [form, formError] = await tryCatch(request.formData());
  if (formError || !form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  // FormData returns null for absent fields; zod's optional/default only handle undefined.
  const field = (name: string) => form.get(name) ?? undefined;
  const parsed = createNodeBodySchema.safeParse({
    kind: field("kind"),
    title: field("title"),
    data: field("data"),
    file: field("file"),
    x: field("x"),
    y: field("y"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const nodeId = crypto.randomUUID();

  if (body.kind === "doc") {
    const raw = await body.file.arrayBuffer();
    const bytes = new Uint8Array(raw);
    const mime = body.file.type || "application/octet-stream";
    const docId = crypto.randomUUID();
    const key = docKey(projectId, docId, body.file.name);
    await putObject(env.FILES, key, bytes, mime);

    await createDocumentNode(env.DB, {
      id: nodeId,
      workspaceId: userWorkspace.id,
      authorId: session.user.id,
      title: body.title ?? "",
      x: body.x,
      y: body.y,
      name: body.file.name.trim(),
      mime,
      sizeBytes: bytes.byteLength,
      r2Key: key,
    });
  } else if (body.kind === "note") {
    await createNoteNode(env.DB, {
      id: nodeId,
      workspaceId: userWorkspace.id,
      authorId: session.user.id,
      title: body.title ?? "",
      x: body.x,
      y: body.y,
      data: body.data,
    });
  } else {
    const { commentId } = await createCommentNode(env.DB, {
      id: nodeId,
      workspaceId: userWorkspace.id,
      authorId: session.user.id,
      title: body.title ?? "",
      x: body.x,
      y: body.y,
      data: body.data,
    });

    if (commentId) {
      notifyAgent(
        env,
        {
          projectId,
          threadId: nodeId,
          workspaceId: userWorkspace.id,
          message: [
            {
              id: commentId,
              role: "user",
              name: session.user.name,
              message: body.data.trim(),
            },
          ],
        },
        ctx,
      );
    }
  }

  await touchProject(env.DB, projectId);

  const node = await getNodeDto(env.DB, nodeId);
  if (node) {
    await publishNodeUpserted(env, userWorkspace.id, node, clientIdFromRequest(request));
  }
  return NextResponse.json({ data: node }, { status: 201 });
}
