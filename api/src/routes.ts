import {
  createProject,
  currentUser,
  docKey,
  ensureSchema,
  getDocument,
  getObject,
  getProject,
  getProjectNode,
  insertDocument,
  deleteEdge,
  insertEdge,
  insertPlanningNode,
  listProjects,
  loadBoard,
  nextNodePosition,
  putObject,
  rowToNode,
  touchProject,
  updatePlanningNode,
  isAllowedProjectDoc,
  type SyncEvent,
} from "@lyzyos/db";
import { createAuth, ensureAuth } from "@lyzyos/auth";
import { notifyAgent } from "./agent";
import { corsHeaders, json } from "./cors";
import { clientIdFromRequest, publishSyncEvent } from "./sync/publish";

export async function handleApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  await ensureSchema(env.DB);
  await ensureAuth(env);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path.startsWith("/api/auth")) {
    return createAuth(env).handler(request);
  }

  if (path === "/health" && request.method === "GET") {
    return new Response("ok", {
      headers: { ...corsHeaders(origin), "Content-Type": "text/plain" },
    });
  }

  const syncMatch = path.match(/^\/api\/projects\/([^/]+)\/sync$/);
  if (syncMatch && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    return upgradeProjectSync(request, env, syncMatch[1]);
  }

  if (path === "/api/projects" && request.method === "GET") {
    const rows = await listProjects(env.DB);
    return json(
      {
        projects: rows.map((p) => ({
          id: p.id,
          name: p.name,
          brief: p.brief,
          ownerId: p.ownerId,
          threadId: p.threadId,
          planningStatus: p.planningStatus,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      },
      {},
      origin,
    );
  }

  if (path === "/api/projects" && request.method === "POST") {
    return createProjectFromRequest(request, env, ctx, origin);
  }

  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && request.method === "GET") {
    const board = await loadBoard(env.DB, projectMatch[1]);
    if (!board) return json({ error: "Not found" }, { status: 404 }, origin);
    return json(board, {}, origin);
  }

  const nodesMatch = path.match(/^\/api\/projects\/([^/]+)\/nodes$/);
  if (nodesMatch && request.method === "GET") {
    const board = await loadBoard(env.DB, nodesMatch[1]);
    if (!board) return json({ error: "Not found" }, { status: 404 }, origin);
    return json({ nodes: board.nodes, edges: board.edges }, {}, origin);
  }

  if (nodesMatch && request.method === "POST") {
    return addHumanNode(request, env, ctx, nodesMatch[1], origin);
  }

  const edgesMatch = path.match(/^\/api\/projects\/([^/]+)\/edges$/);
  if (edgesMatch && request.method === "POST") {
    return createProjectEdge(request, env, edgesMatch[1], origin);
  }

  const edgeMatch = path.match(/^\/api\/projects\/([^/]+)\/edges\/([^/]+)$/);
  if (edgeMatch && request.method === "DELETE") {
    return deleteProjectEdge(request, env, edgeMatch[1], edgeMatch[2], origin);
  }

  const nodeMatch = path.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)$/);
  if (nodeMatch && request.method === "PATCH") {
    return patchHumanNode(request, env, ctx, nodeMatch[1], nodeMatch[2], origin);
  }

  const answerMatch = path.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)\/answer$/);
  if (answerMatch && request.method === "POST") {
    return answerQuestion(request, env, ctx, answerMatch[1], answerMatch[2], origin);
  }

  const docsMatch = path.match(/^\/api\/projects\/([^/]+)\/documents$/);
  if (docsMatch && request.method === "POST") {
    return addDocument(request, env, ctx, docsMatch[1], origin);
  }

  const docFileMatch = path.match(/^\/api\/projects\/([^/]+)\/documents\/([^/]+)\/file$/);
  if (docFileMatch && request.method === "GET") {
    return serveDocumentFile(env, docFileMatch[1], docFileMatch[2], origin);
  }

  return json({ error: "Not found" }, { status: 404 }, origin);
}

async function upgradeProjectSync(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  const project = await getProject(env.DB, projectId);
  if (!project) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  url.searchParams.set("projectId", projectId);
  const stub = env.WORKSPACE_SYNC.getByName(projectId);
  return stub.fetch(new Request(url.toString(), request));
}

async function fanout(
  env: Env,
  request: Request,
  projectId: string,
  event: SyncEvent,
): Promise<void> {
  try {
    await publishSyncEvent(env, projectId, event, clientIdFromRequest(request));
  } catch (err) {
    console.error("sync publish failed", err);
  }
}

async function serveDocumentFile(
  env: Env,
  projectId: string,
  docId: string,
  origin: string | null,
): Promise<Response> {
  const doc = await getDocument(env.DB, projectId, docId);
  if (!doc) return json({ error: "Not found" }, { status: 404 }, origin);

  const obj = await getObject(env.FILES, doc.r2Key);
  if (!obj) return json({ error: "File missing" }, { status: 404 }, origin);

  const headers = new Headers(corsHeaders(origin));
  headers.set(
    "Content-Type",
    doc.mime || obj.httpMetadata?.contentType || "application/octet-stream",
  );
  headers.set("Cache-Control", "private, max-age=3600");
  if (doc.name) {
    headers.set("Content-Disposition", `inline; filename="${doc.name.replace(/"/g, "")}"`);
  }
  return new Response(obj.body, { headers });
}

async function createProjectFromRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null,
): Promise<Response> {
  const contentType = request.headers.get("Content-Type") ?? "";
  let brief = "";
  const filePayloads: { name: string; mime: string; bytes: Uint8Array; text: string }[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    brief = String(form.get("brief") ?? "").trim();
    for (const entry of form.getAll("files")) {
      if (!(entry instanceof File)) continue;
      const mime = entry.type || "application/octet-stream";
      if (!isAllowedProjectDoc({ name: entry.name, mime })) continue;
      const raw = await entry.arrayBuffer();
      const bytes = new Uint8Array(raw);
      const text = await extractText(entry, raw);
      filePayloads.push({
        name: entry.name,
        mime,
        bytes,
        text,
      });
    }
  } else {
    const body = (await request.json()) as {
      brief?: string;
      documents?: { name: string; text: string; mime?: string }[];
    };
    brief = body.brief?.trim() ?? "";
    for (const doc of body.documents ?? []) {
      const mime = doc.mime ?? "text/plain";
      if (!isAllowedProjectDoc({ name: doc.name, mime })) continue;
      const text = doc.text ?? "";
      filePayloads.push({
        name: doc.name,
        mime,
        bytes: new TextEncoder().encode(text),
        text,
      });
    }
  }

  if (brief.length === 0 && filePayloads.length === 0) {
    return json(
      { error: "Brief or at least one image/PDF document is required." },
      { status: 400 },
      origin,
    );
  }

  const user = currentUser();
  const projectId = crypto.randomUUID();
  // Title is set by Lyzy during kickoff via set_project_title.
  await createProject(env.DB, {
    id: projectId,
    name: "Untitled project",
    brief,
    ownerId: user.id,
  });

  const briefPos = await nextNodePosition(env.DB, projectId, 0);
  if (brief.length > 0) {
    await insertPlanningNode(env.DB, {
      id: crypto.randomUUID(),
      projectId,
      kind: "brief",
      title: "Client brief",
      body: brief,
      authorKind: "human",
      authorName: user.name,
      x: briefPos.x,
      y: briefPos.y,
    });
  }

  let docIndex = 0;
  for (const file of filePayloads) {
    const docId = crypto.randomUUID();
    const key = docKey(projectId, docId, file.name);
    await putObject(env.FILES, key, file.bytes, file.mime);
    await insertDocument(env.DB, {
      id: docId,
      projectId,
      name: file.name,
      r2Key: key,
      mime: file.mime,
      sizeBytes: file.bytes.byteLength,
      textExtract: file.text,
    });
    const pos = await nextNodePosition(env.DB, projectId, 1);
    await insertPlanningNode(env.DB, {
      id: crypto.randomUUID(),
      projectId,
      kind: "doc",
      title: "",
      body: file.text.slice(0, 4000),
      authorKind: "human",
      authorName: user.name,
      meta: docId,
      x: pos.x,
      y: pos.y + docIndex * 20,
    });
    docIndex += 1;
  }

  await touchProject(env.DB, projectId);
  notifyAgent(env, ctx, "/agent/kickoff", { projectId });

  const board = await loadBoard(env.DB, projectId);
  if (board) {
    await fanout(env, request, projectId, {
      type: "board.replace",
      board: {
        project: board.project,
        nodes: board.nodes,
        edges: board.edges,
      },
    });
  }
  return json(
    { projectId, project: board?.project, nodes: board?.nodes ?? [] },
    { status: 201 },
    origin,
  );
}

async function addHumanNode(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  projectId: string,
  origin: string | null,
): Promise<Response> {
  const project = await getProject(env.DB, projectId);
  if (!project) return json({ error: "Not found" }, { status: 404 }, origin);

  const body = (await request.json()) as {
    kind?: "note" | "question";
    title?: string;
    text?: string;
    x?: number;
    y?: number;
  };
  const kind = body.kind === "question" ? "question" : "note";
  const text = body.text?.trim() ?? "";
  const title = body.title?.trim() || (kind === "question" ? "Comment" : "Note");

  const fallback = await nextNodePosition(env.DB, projectId, kind === "question" ? 4 : 2);
  const x = typeof body.x === "number" ? body.x : fallback.x;
  const y = typeof body.y === "number" ? body.y : fallback.y;

  const user = currentUser();
  const node = await insertPlanningNode(env.DB, {
    id: crypto.randomUUID(),
    projectId,
    kind,
    title,
    body: text,
    authorKind: "human",
    authorName: user.name,
    status: kind === "question" ? "open" : undefined,
    x,
    y,
  });
  await touchProject(env.DB, projectId);
  const dto = rowToNode(node);
  await fanout(env, request, projectId, { type: "node.upserted", node: dto });
  notifyAgent(env, ctx, "/agent/refresh", { projectId });
  return json({ node: dto }, {}, origin);
}

async function patchHumanNode(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  projectId: string,
  nodeId: string,
  origin: string | null,
): Promise<Response> {
  const existing = await getProjectNode(env.DB, projectId, nodeId);
  if (!existing) return json({ error: "Not found" }, { status: 404 }, origin);

  const body = (await request.json()) as {
    title?: string;
    text?: string;
    body?: string;
    x?: number;
    y?: number;
  };
  const nextBody = body.text ?? body.body;
  const hasContent = typeof body.title === "string" || typeof nextBody === "string";
  const hasPosition = typeof body.x === "number" || typeof body.y === "number";

  if (!hasContent && !hasPosition) {
    return json({ error: "Nothing to update." }, { status: 400 }, origin);
  }
  if (hasContent && existing.authorKind !== "human") {
    return json({ error: "Only human nodes can be edited." }, { status: 400 }, origin);
  }

  await updatePlanningNode(env.DB, nodeId, {
    title: hasContent ? body.title : undefined,
    body: typeof nextBody === "string" ? nextBody : undefined,
    x: typeof body.x === "number" ? body.x : undefined,
    y: typeof body.y === "number" ? body.y : undefined,
  });
  await touchProject(env.DB, projectId);
  // Content edits wake the agent; position-only moves stay quiet.
  if (hasContent) {
    notifyAgent(env, ctx, "/agent/refresh", { projectId });
  }
  const updated = await getProjectNode(env.DB, projectId, nodeId);
  const dto = updated ? rowToNode(updated) : null;
  if (dto) {
    await fanout(env, request, projectId, { type: "node.upserted", node: dto });
  }
  return json({ node: dto }, {}, origin);
}

async function answerQuestion(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  projectId: string,
  nodeId: string,
  origin: string | null,
): Promise<Response> {
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (text.length === 0) return json({ error: "Answer is required." }, { status: 400 }, origin);

  const question = await getProjectNode(env.DB, projectId, nodeId);
  if (!question || question.kind !== "question") {
    return json({ error: "Question not found." }, { status: 404 }, origin);
  }

  await updatePlanningNode(env.DB, nodeId, { status: "answered" });
  const pos = await nextNodePosition(env.DB, projectId, 2);
  const user = currentUser();
  const answer = await insertPlanningNode(env.DB, {
    id: crypto.randomUUID(),
    projectId,
    kind: "answer",
    title: "Your answer",
    body: text,
    authorKind: "human",
    authorName: user.name,
    meta: nodeId,
    x: pos.x,
    y: pos.y,
  });
  await touchProject(env.DB, projectId);
  const answered = await getProjectNode(env.DB, projectId, nodeId);
  if (answered) {
    await fanout(env, request, projectId, {
      type: "node.upserted",
      node: rowToNode(answered),
    });
  }
  const answerDto = rowToNode(answer);
  await fanout(env, request, projectId, { type: "node.upserted", node: answerDto });
  notifyAgent(env, ctx, "/agent/continue", { projectId, userMessage: text });
  return json({ answer: answerDto }, {}, origin);
}

async function addDocument(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  projectId: string,
  origin: string | null,
): Promise<Response> {
  const project = await getProject(env.DB, projectId);
  if (!project) return json({ error: "Not found" }, { status: 404 }, origin);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "file is required." }, { status: 400 }, origin);
  }
  if (!isAllowedProjectDoc({ name: file.name, mime: file.type })) {
    return json({ error: "Only images and PDFs are supported." }, { status: 400 }, origin);
  }
  const rawX = form.get("x");
  const rawY = form.get("y");
  const parsedX = typeof rawX === "string" ? Number(rawX) : NaN;
  const parsedY = typeof rawY === "string" ? Number(rawY) : NaN;

  const raw = await file.arrayBuffer();
  const bytes = new Uint8Array(raw);
  const text = await extractText(file, raw);
  const docId = crypto.randomUUID();
  const key = docKey(projectId, docId, file.name);
  await putObject(env.FILES, key, bytes, file.type || undefined);
  await insertDocument(env.DB, {
    id: docId,
    projectId,
    name: file.name,
    r2Key: key,
    mime: file.type || null,
    sizeBytes: bytes.byteLength,
    textExtract: text,
  });
  const fallback = await nextNodePosition(env.DB, projectId, 1);
  const user = currentUser();
  const node = await insertPlanningNode(env.DB, {
    id: crypto.randomUUID(),
    projectId,
    kind: "doc",
    title: "",
    body: text.slice(0, 4000),
    authorKind: "human",
    authorName: user.name,
    meta: docId,
    x: Number.isFinite(parsedX) ? parsedX : fallback.x,
    y: Number.isFinite(parsedY) ? parsedY : fallback.y,
  });
  await touchProject(env.DB, projectId);
  const dto = rowToNode(node);
  await fanout(env, request, projectId, { type: "node.upserted", node: dto });
  notifyAgent(env, ctx, "/agent/ingest", { projectId, name: file.name, text });
  return json({ ok: true, name: file.name, text, node: dto }, { status: 201 }, origin);
}

async function deleteProjectEdge(
  request: Request,
  env: Env,
  projectId: string,
  edgeId: string,
  origin: string | null,
): Promise<Response> {
  const project = await getProject(env.DB, projectId);
  if (!project) return json({ error: "Not found" }, { status: 404 }, origin);

  const removed = await deleteEdge(env.DB, projectId, edgeId);
  if (!removed) return json({ error: "Not found" }, { status: 404 }, origin);

  await touchProject(env.DB, projectId);
  await fanout(env, request, projectId, { type: "edge.removed", edgeId });
  return json({ ok: true }, {}, origin);
}

async function createProjectEdge(
  request: Request,
  env: Env,
  projectId: string,
  origin: string | null,
): Promise<Response> {
  const project = await getProject(env.DB, projectId);
  if (!project) return json({ error: "Not found" }, { status: 404 }, origin);

  const body = (await request.json()) as { sourceId?: string; targetId?: string };
  const sourceId = body.sourceId?.trim();
  const targetId = body.targetId?.trim();
  if (!sourceId || !targetId) {
    return json({ error: "sourceId and targetId are required." }, { status: 400 }, origin);
  }
  if (sourceId === targetId) {
    return json({ error: "Cannot connect a node to itself." }, { status: 400 }, origin);
  }

  const source = await getProjectNode(env.DB, projectId, sourceId);
  const target = await getProjectNode(env.DB, projectId, targetId);
  if (!source || !target) {
    return json({ error: "Invalid node ids." }, { status: 400 }, origin);
  }

  const board = await loadBoard(env.DB, projectId);
  if (board?.edges.some((e) => e.sourceId === sourceId && e.targetId === targetId)) {
    return json({ error: "Connection already exists." }, { status: 409 }, origin);
  }

  const id = crypto.randomUUID();
  await insertEdge(env.DB, { id, projectId, sourceId, targetId });
  await touchProject(env.DB, projectId);
  const edge = { id, sourceId, targetId };
  await fanout(env, request, projectId, { type: "edge.upserted", edge });
  return json({ edge }, { status: 201 }, origin);
}

async function extractText(file: File, bytes: ArrayBuffer): Promise<string> {
  const mime = file.type || "";
  const name = file.name.toLowerCase();
  const isText =
    mime.startsWith("text/") ||
    name.endsWith(".md") ||
    name.endsWith(".txt") ||
    name.endsWith(".json") ||
    name.endsWith(".csv");
  if (!isText) return "";
  try {
    return new TextDecoder().decode(bytes).slice(0, 200_000);
  } catch {
    return "";
  }
}
