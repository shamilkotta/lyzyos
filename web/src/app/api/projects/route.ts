import { notifyAgent } from "@/server/agent";
import { KICKOFF_PROMPT } from "@/server/constants";
import { getEnv } from "@/server/env";
import { requireSession } from "@/server/session";
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
  touchProject,
  workspaces,
} from "@lyzyos/db";
import { NextResponse } from "next/server";

type KickoffNode =
  | {
      title: string;
      kind: "note";
      data: string;
    }
  | {
      title: string;
      kind: "doc";
      data: { name: string; mime: string; bytes: Uint8Array };
    };

export async function GET() {
  const session = await requireSession();
  const env = await getEnv();
  const userProjects = await listProjectsForUser(env.DB, session.user.id);

  return NextResponse.json({ data: userProjects }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const env = await getEnv();
  const db = createDb(env.DB);

  const contentType = request.headers.get("Content-Type") ?? "";
  const newNodes: KickoffNode[] = [];

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  const form = await request.formData();
  const brief = String(form.get("brief") ?? "").trim();
  if (!brief.length) return NextResponse.json({ error: "Brief is required" }, { status: 400 });

  newNodes.push({
    title: "Intake",
    kind: "note",
    data: brief,
  });

  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File)) continue;
    const mime = entry.type || "application/octet-stream";
    const raw = await entry.arrayBuffer();
    const text = await extractText(entry, raw);
    if (text) {
      newNodes.push({
        title: entry.name,
        kind: "note",
        data: text,
      });
      continue;
    }
    newNodes.push({
      title: "",
      kind: "doc",
      data: {
        name: entry.name.trim(),
        mime,
        bytes: new Uint8Array(raw),
      },
    });
  }

  // One batch so a failure never leaves a project without its planning workspace or owner.
  const projectId = crypto.randomUUID();
  const [[project], [workspace]] = await db.batch([
    db
      .insert(projects)
      .values({ id: projectId, name: "Untitled project", ownerId: session.user.id })
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
      const x = 40 + i * 280;
      const y = 40;
      const base = {
        workspaceId: workspace.id,
        authorId: session.user.id,
        title: node.title,
        x,
        y,
      };
      if (node.kind === "doc") {
        const docId = crypto.randomUUID();
        const key = docKey(project.id, docId, node.data.name);
        await putObject(env.FILES, key, node.data.bytes, node.data.mime);
        await createDocumentNode(env.DB, {
          ...base,
          name: node.data.name,
          mime: node.data.mime,
          sizeBytes: node.data.bytes.byteLength,
          r2Key: key,
        });
        return;
      }
      await createNoteNode(env.DB, { ...base, data: node.data });
    }),
  );

  await touchProject(env.DB, project.id);

  notifyAgent(env, {
    projectId: project.id,
    threadId: workspace.id,
    workspaceId: workspace.id,
    message: [
      {
        role: "user",
        name: session.user.name,
        message: KICKOFF_PROMPT,
      },
    ],
  });

  return NextResponse.json(
    {
      data: { projectId: project.id, workspaceId: workspace.id },
    },
    { status: 201 },
  );
}

async function extractText(file: File, bytes: ArrayBuffer) {
  const mime = file.type || "";
  if (!isTextLikeFile(mime, file.name)) return "";
  try {
    return new TextDecoder().decode(bytes).slice(0, 200_000);
  } catch {
    return "";
  }
}
