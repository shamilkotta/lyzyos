import {
  createCommentNode,
  createDocumentNode,
  createNoteNode,
  docKey,
  getNodeDto,
  putObject,
  touchProject,
} from "@lyzyos/db";
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/docs";
import { notifyAgent } from "@/server/agent";
import { getExecutionContext } from "@/server/env";
import { clientIdFromRequest, json, parseWith, readForm, route } from "@/server/http";
import { publishSyncEvent } from "@/server/sync/publish";
import { requireWorkspace } from "@/server/workspace";

type Params = { params: Promise<{ projectId: string; workspaceId: string }> };

const placement = {
  title: z.string().trim().optional(),
  x: z.coerce.number().finite(),
  y: z.coerce.number().finite(),
};

const createNodeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("note"), data: z.string().trim().default(""), ...placement }),
  z.object({ kind: z.literal("comment"), data: z.string().trim().default(""), ...placement }),
  z.object({
    kind: z.literal("doc"),
    file: z.file().max(MAX_UPLOAD_BYTES, "File is too large"),
    ...placement,
  }),
]);

export const POST = route<Params>(async (request, { params }) => {
  const { projectId, workspaceId } = await params;
  const [{ session, env, workspace }, ctx] = await Promise.all([
    requireWorkspace({ projectId, workspaceId }),
    getExecutionContext(),
  ]);

  const form = await readForm(request);
  // FormData returns null for absent fields; zod's optional/default only handle undefined.
  const field = (name: string) => form.get(name) ?? undefined;
  const body = parseWith(createNodeSchema, {
    kind: field("kind"),
    title: field("title"),
    data: field("data"),
    file: field("file"),
    x: field("x"),
    y: field("y"),
  });

  const nodeId = crypto.randomUUID();
  const base = {
    id: nodeId,
    workspaceId: workspace.id,
    authorId: session.user.id,
    title: body.title ?? "",
    x: body.x,
    y: body.y,
  };

  if (body.kind === "doc") {
    const bytes = new Uint8Array(await body.file.arrayBuffer());
    const mime = body.file.type || "application/octet-stream";
    const key = docKey(projectId, crypto.randomUUID(), body.file.name);
    await putObject(env.FILES, key, bytes, mime);
    await createDocumentNode(env.DB, {
      ...base,
      name: body.file.name.trim(),
      mime,
      sizeBytes: bytes.byteLength,
      r2Key: key,
    });
  } else if (body.kind === "note") {
    await createNoteNode(env.DB, { ...base, data: body.data });
  } else {
    const { commentId } = await createCommentNode(env.DB, { ...base, data: body.data });
    if (commentId) {
      notifyAgent(
        env,
        {
          projectId,
          threadId: nodeId,
          workspaceId: workspace.id,
          message: [{ id: commentId, role: "user", name: session.user.name, message: body.data }],
        },
        ctx,
      );
    }
  }

  const [node] = await Promise.all([getNodeDto(env.DB, nodeId), touchProject(env.DB, projectId)]);
  if (node) {
    await publishSyncEvent(
      env,
      workspace.id,
      { type: "node.upserted", node },
      clientIdFromRequest(request),
    );
  }
  return json(node, 201);
});
