import {
  createDb,
  createDocumentNode,
  createNoteNode,
  DEFAULT_WORKSPACES,
  docKey,
  isTextLikeFile,
  listProjectsForUser,
  projectMembers,
  projects,
  putObject,
  workspaces,
} from "@lyzyos/db";
import { MAX_KICKOFF_FILES, MAX_UPLOAD_BYTES } from "@/lib/docs";
import { UNTITLED_PROJECT } from "@/lib/constants";
import { notifyAgent } from "@/server/agent";
import { KICKOFF_PROMPT } from "@/server/constants";
import { getExecutionContext } from "@/server/env";
import { apiContext, HttpError, json, readForm, route } from "@/server/http";

const MAX_TEXT_CHARS = 200_000;
const NODE_SPACING_X = 280;

type KickoffNode =
  | { kind: "note"; title: string; data: string }
  | { kind: "doc"; title: string; data: { name: string; mime: string; bytes: Uint8Array } };

export const GET = route(async () => {
  const { session, env } = await apiContext();
  return json(await listProjectsForUser(env.DB, session.user.id));
});

/** Text-like attachments become notes (readable on the board); everything else is a document. */
async function toKickoffNode(file: File): Promise<KickoffNode> {
  const raw = await file.arrayBuffer();
  if (isTextLikeFile(file.type || "", file.name)) {
    const text = new TextDecoder().decode(raw).slice(0, MAX_TEXT_CHARS);
    if (text) return { kind: "note", title: file.name, data: text };
  }
  return {
    kind: "doc",
    title: "",
    data: {
      name: file.name.trim(),
      mime: file.type || "application/octet-stream",
      bytes: new Uint8Array(raw),
    },
  };
}

export const POST = route(async (request) => {
  const [{ session, env }, ctx] = await Promise.all([apiContext(), getExecutionContext()]);
  const form = await readForm(request);

  const brief = String(form.get("brief") ?? "").trim();
  if (!brief) throw new HttpError(400, "Brief is required");

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length > MAX_KICKOFF_FILES) {
    throw new HttpError(400, `Attach at most ${MAX_KICKOFF_FILES} files`);
  }
  const tooLarge = files.find((file) => file.size > MAX_UPLOAD_BYTES);
  if (tooLarge) throw new HttpError(413, `${tooLarge.name} is too large`);

  const newNodes: KickoffNode[] = [
    { kind: "note", title: "Intake", data: brief },
    ...(await Promise.all(files.map(toKickoffNode))),
  ];

  // One batch so a failure never leaves a project without its planning workspace or owner.
  const db = createDb(env.DB);
  const projectId = crypto.randomUUID();
  const [, [workspace]] = await db.batch([
    db
      .insert(projects)
      .values({ id: projectId, name: UNTITLED_PROJECT, ownerId: session.user.id })
      .returning(),
    db
      .insert(workspaces)
      .values({
        projectId,
        slug: DEFAULT_WORKSPACES.planning.id,
        name: DEFAULT_WORKSPACES.planning.name,
        kind: DEFAULT_WORKSPACES.planning.kind,
      })
      .returning(),
    db.insert(projectMembers).values({ projectId, userId: session.user.id }),
  ]);

  await Promise.all(
    newNodes.map(async (node, i) => {
      const base = {
        workspaceId: workspace.id,
        authorId: session.user.id,
        title: node.title,
        x: 40 + i * NODE_SPACING_X,
        y: 40,
      };
      if (node.kind === "note") {
        await createNoteNode(env.DB, { ...base, data: node.data });
        return;
      }
      const key = docKey(projectId, crypto.randomUUID(), node.data.name);
      await putObject(env.FILES, key, node.data.bytes, node.data.mime);
      await createDocumentNode(env.DB, {
        ...base,
        name: node.data.name,
        mime: node.data.mime,
        sizeBytes: node.data.bytes.byteLength,
        r2Key: key,
      });
    }),
  );

  notifyAgent(
    env,
    {
      projectId,
      threadId: workspace.id,
      workspaceId: workspace.id,
      message: [{ role: "user", name: session.user.name, message: KICKOFF_PROMPT }],
    },
    ctx,
  );

  return json({ projectId, workspaceId: workspace.id }, 201);
});
