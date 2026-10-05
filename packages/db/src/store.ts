import { and, asc, desc, eq, sql } from "drizzle-orm";
import { createDb, type Db } from "./client";
import { documents, nodeEdges, planningNodes, projects } from "./schema";
import type {
  AuthorKind,
  DocumentRow,
  NodeEdgeRow,
  PlanningNodeKind,
  PlanningNodeRow,
  ProjectRow,
} from "./types";
import { rowToNode as toNode, rowToProject as toProject } from "./types";
import { DEFAULT_USER } from "./users";

function db(d1: D1Database): Db {
  return createDb(d1);
}

/** Apply table DDL once per isolate (local / first boot). Prefer drizzle-kit migrate in prod. */
export async function ensureSchema(d1: D1Database): Promise<void> {
  await d1.batch([
    // Better Auth tables (from CLI-generated auth-schema.ts)
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified INTEGER NOT NULL DEFAULT false,
        image TEXT,
        created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
        updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
        updated_at INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at INTEGER,
        refresh_token_expires_at INTEGER,
        scope TEXT,
        password TEXT,
        created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
        updated_at INTEGER NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
        updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
      )
    `),
    d1.prepare(`CREATE INDEX IF NOT EXISTS session_userId_idx ON session(user_id)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS account_userId_idx ON account(user_id)`),
    d1.prepare(
      `CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier)`,
    ),

    // App tables
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brief TEXT NOT NULL DEFAULT '',
        owner_id TEXT NOT NULL DEFAULT 'usr_default',
        thread_id TEXT,
        planning_status TEXT NOT NULL DEFAULT 'in_progress',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        r2_key TEXT NOT NULL,
        mime TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        text_extract TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS planning_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        author_kind TEXT NOT NULL,
        author_name TEXT NOT NULL DEFAULT '',
        status TEXT,
        meta TEXT,
        x REAL NOT NULL DEFAULT 0,
        y REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS node_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_nodes_project ON planning_nodes(project_id)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_edges_project ON node_edges(project_id)`),
  ]);

  // Existing local DBs created before owner_id — add the column if missing.
  try {
    await d1
      .prepare(`ALTER TABLE projects ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'usr_default'`)
      .run();
  } catch {
    /* column already exists */
  }
}

export async function createProject(
  d1: D1Database,
  input: { id: string; name: string; brief: string; ownerId?: string },
): Promise<ProjectRow> {
  const now = Date.now();
  const database = db(d1);
  await database.insert(projects).values({
    id: input.id,
    name: input.name,
    brief: input.brief,
    ownerId: input.ownerId ?? DEFAULT_USER.id,
    planningStatus: "in_progress",
    createdAt: now,
    updatedAt: now,
  });
  const row = await getProject(d1, input.id);
  if (!row) throw new Error("Project not created.");
  return row;
}

export async function getProject(d1: D1Database, id: string): Promise<ProjectRow | null> {
  const row = await db(d1).query.projects.findFirst({
    where: eq(projects.id, id),
  });
  return row ?? null;
}

export async function listProjects(d1: D1Database): Promise<ProjectRow[]> {
  return db(d1).query.projects.findMany({
    orderBy: [desc(projects.updatedAt)],
  });
}

export async function updateProjectThread(
  d1: D1Database,
  projectId: string,
  threadId: string,
): Promise<void> {
  await db(d1)
    .update(projects)
    .set({ threadId, updatedAt: Date.now() })
    .where(eq(projects.id, projectId));
}

export async function updateProjectName(
  d1: D1Database,
  projectId: string,
  name: string,
): Promise<void> {
  const cleaned = name.trim().slice(0, 80);
  if (cleaned.length === 0) throw new Error("Project name is empty.");
  await db(d1)
    .update(projects)
    .set({ name: cleaned, updatedAt: Date.now() })
    .where(eq(projects.id, projectId));
}

export async function touchProject(d1: D1Database, projectId: string): Promise<void> {
  await db(d1).update(projects).set({ updatedAt: Date.now() }).where(eq(projects.id, projectId));
}

export async function insertDocument(
  d1: D1Database,
  input: {
    id: string;
    projectId: string;
    name: string;
    r2Key: string;
    mime: string | null;
    sizeBytes: number;
    textExtract: string;
  },
): Promise<DocumentRow> {
  const now = Date.now();
  const database = db(d1);
  await database.insert(documents).values({
    id: input.id,
    projectId: input.projectId,
    name: input.name,
    r2Key: input.r2Key,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    textExtract: input.textExtract,
    createdAt: now,
  });
  const row = await database.query.documents.findFirst({
    where: eq(documents.id, input.id),
  });
  if (!row) throw new Error("Document not created.");
  return row;
}

export async function listDocuments(d1: D1Database, projectId: string): Promise<DocumentRow[]> {
  return db(d1).query.documents.findMany({
    where: eq(documents.projectId, projectId),
    orderBy: [asc(documents.createdAt)],
  });
}

export async function getDocument(
  d1: D1Database,
  projectId: string,
  docId: string,
): Promise<DocumentRow | null> {
  const row = await db(d1).query.documents.findFirst({
    where: and(eq(documents.id, docId), eq(documents.projectId, projectId)),
  });
  return row ?? null;
}

export async function insertPlanningNode(
  d1: D1Database,
  input: {
    id: string;
    projectId: string;
    kind: PlanningNodeKind;
    title: string;
    body?: string;
    authorKind: AuthorKind;
    authorName: string;
    status?: string;
    meta?: string;
    x?: number;
    y?: number;
  },
): Promise<PlanningNodeRow> {
  const now = Date.now();
  await db(d1)
    .insert(planningNodes)
    .values({
      id: input.id,
      projectId: input.projectId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      authorKind: input.authorKind,
      authorName: input.authorName,
      status: input.status ?? null,
      meta: input.meta ?? null,
      x: input.x ?? 0,
      y: input.y ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  const row = await getPlanningNode(d1, input.id);
  if (!row) throw new Error("Node not created.");
  return row;
}

export async function getPlanningNode(d1: D1Database, id: string): Promise<PlanningNodeRow | null> {
  const row = await db(d1).query.planningNodes.findFirst({
    where: eq(planningNodes.id, id),
  });
  return row ?? null;
}

export async function listPlanningNodes(
  d1: D1Database,
  projectId: string,
): Promise<PlanningNodeRow[]> {
  return db(d1).query.planningNodes.findMany({
    where: eq(planningNodes.projectId, projectId),
    orderBy: [asc(planningNodes.createdAt)],
  });
}

export async function updatePlanningNode(
  d1: D1Database,
  id: string,
  patch: { body?: string; status?: string; title?: string; x?: number; y?: number },
): Promise<void> {
  const row = await getPlanningNode(d1, id);
  if (!row) throw new Error("Node not found.");
  await db(d1)
    .update(planningNodes)
    .set({
      title: patch.title ?? row.title,
      body: patch.body ?? row.body,
      status: patch.status ?? row.status,
      x: typeof patch.x === "number" ? patch.x : row.x,
      y: typeof patch.y === "number" ? patch.y : row.y,
      updatedAt: Date.now(),
    })
    .where(eq(planningNodes.id, id));
}

export async function insertEdge(
  d1: D1Database,
  input: { id: string; projectId: string; sourceId: string; targetId: string },
): Promise<void> {
  await db(d1).insert(nodeEdges).values({
    id: input.id,
    projectId: input.projectId,
    sourceId: input.sourceId,
    targetId: input.targetId,
  });
}

export async function deleteEdge(
  d1: D1Database,
  projectId: string,
  edgeId: string,
): Promise<boolean> {
  const result = await db(d1)
    .delete(nodeEdges)
    .where(and(eq(nodeEdges.id, edgeId), eq(nodeEdges.projectId, projectId)));
  return (result.meta?.changes ?? 0) > 0;
}

export async function listEdges(d1: D1Database, projectId: string): Promise<NodeEdgeRow[]> {
  return db(d1).query.nodeEdges.findMany({
    where: eq(nodeEdges.projectId, projectId),
  });
}

export async function getProjectNode(
  d1: D1Database,
  projectId: string,
  nodeId: string,
): Promise<PlanningNodeRow | null> {
  const row = await db(d1).query.planningNodes.findFirst({
    where: and(eq(planningNodes.id, nodeId), eq(planningNodes.projectId, projectId)),
  });
  return row ?? null;
}

export async function loadBoard(d1: D1Database, projectId: string) {
  const project = await getProject(d1, projectId);
  if (!project) return null;
  const docs = await listDocuments(d1, projectId);
  const docById = new Map(docs.map((d) => [d.id, d]));
  const nodes = (await listPlanningNodes(d1, projectId)).map((row) => {
    const linked = row.kind === "doc" && row.meta ? docById.get(row.meta) : null;
    return toNode(row, linked);
  });
  const edges = (await listEdges(d1, projectId)).map((e) => ({
    id: e.id,
    sourceId: e.sourceId,
    targetId: e.targetId,
  }));
  return { project: toProject(project), nodes, edges };
}

export async function nextNodePosition(d1: D1Database, projectId: string, column: number) {
  const nodes = await listPlanningNodes(d1, projectId);
  const inColumn = nodes.filter((n) => Math.round(n.x / 280) === column);
  const y = 40 + inColumn.length * 140;
  return { x: 40 + column * 280, y };
}

/** Count helper kept for future queries without raw SQL sprawl. */
export async function countPlanningNodes(d1: D1Database, projectId: string): Promise<number> {
  const result = await db(d1)
    .select({ count: sql<number>`count(*)` })
    .from(planningNodes)
    .where(eq(planningNodes.projectId, projectId));
  return Number(result[0]?.count ?? 0);
}
