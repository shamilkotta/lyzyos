import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  or,
  type InferInsertModel,
  type SQL,
  type InferSelectModel,
} from "drizzle-orm";
import { AGENT_ROLE, resolveAuthorKind } from "./constants";
import { user } from "./auth.schema";
import { createDb, type Db } from "./client";
import {
  comments,
  documents,
  nodeEdges,
  nodes,
  notes,
  projectMembers,
  projects,
  workspaceMembers,
  workspaces,
} from "./project.schema";
import {
  isNodeRowOfKind,
  rowToEdge,
  rowToNode,
  rowToProject,
  rowToWorkspace,
  type MemberPreview,
  type WorkspaceForBoard,
} from "./types";

const userPreview = {
  columns: {
    id: true,
    name: true,
    image: true,
    role: true,
  },
} as const;

const nodeWithRelations = {
  author: userPreview,
  comments: {
    with: {
      user: userPreview,
    },
  },
  notes: true,
  documents: true,
} as const;

const workspaceColumns = {
  id: workspaces.id,
  projectId: workspaces.projectId,
  slug: workspaces.slug,
  name: workspaces.name,
  kind: workspaces.kind,
  status: workspaces.status,
  statusNote: workspaces.statusNote,
  attention: workspaces.attention,
  createdAt: workspaces.createdAt,
  updatedAt: workspaces.updatedAt,
};

const projectColumns = {
  id: projects.id,
  name: projects.name,
  ownerId: projects.ownerId,
  status: projects.status,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
};

const workspaceWithProjectSelect = {
  ...workspaceColumns,
  project: projectColumns,
};

function db(d1: D1Database) {
  return createDb(d1);
}

function sqlOr(first: SQL, ...rest: SQL[]) {
  return or(first, ...rest) ?? first;
}

function sqlAnd(first: SQL, ...rest: SQL[]) {
  return and(first, ...rest) ?? first;
}

function workspaceIdOrSlugMatch(idOrSlug: string) {
  return sqlOr(eq(workspaces.id, idOrSlug), eq(workspaces.slug, idOrSlug));
}

function hasProjectAccess(database: Db, userId: string) {
  return sqlOr(
    eq(projects.ownerId, userId),
    exists(
      database
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, userId))),
    ),
  );
}

function hasWorkspaceMembership(database: Db, userId: string) {
  return exists(
    database
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)),
      ),
  );
}

export function canAccessWorkspace(database: Db, userId: string) {
  return sqlOr(hasProjectAccess(database, userId), hasWorkspaceMembership(database, userId));
}

function canSeeProject(database: Db, userId: string) {
  return sqlOr(
    hasProjectAccess(database, userId),
    exists(
      database
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(and(eq(workspaces.projectId, projects.id), eq(workspaceMembers.userId, userId))),
    ),
  );
}

type CreateNodeInput = Pick<
  InferInsertModel<typeof nodes>,
  "workspaceId" | "authorId" | "title" | "x" | "y"
> & { id?: string };

function nodeInsertValues(
  input: CreateNodeInput & { kind: InferInsertModel<typeof nodes>["kind"] },
) {
  return {
    id: input.id ?? crypto.randomUUID(),
    workspaceId: input.workspaceId,
    authorId: input.authorId,
    kind: input.kind,
    title: input.title,
    x: input.x,
    y: input.y,
  };
}

type RosterUser = { id: string; name: string; image?: string | null; role?: string | null };

function toMemberPreview(u: RosterUser): MemberPreview {
  return { id: u.id, name: u.name, image: u.image ?? null, kind: resolveAuthorKind(u.role) };
}

function mergeMemberPreviews(groups: ReadonlyArray<ReadonlyArray<{ user: RosterUser }>>) {
  const members: MemberPreview[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const member of group) {
      if (seen.has(member.user.id)) continue;
      seen.add(member.user.id);
      members.push(toMemberPreview(member.user));
    }
  }
  return members;
}

async function findAccessibleWorkspace(d1: D1Database, userId: string, where: SQL) {
  const database = db(d1);
  const [row] = await database
    .select(workspaceWithProjectSelect)
    .from(workspaces)
    .innerJoin(projects, eq(projects.id, workspaces.projectId))
    .where(and(where, canAccessWorkspace(database, userId)))
    .limit(1);

  return row ?? null;
}

export async function listProjectsForUser(d1: D1Database, userId: string) {
  const database = db(d1);
  return database
    .select()
    .from(projects)
    .where(canSeeProject(database, userId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectForUser(d1: D1Database, projectId: string, userId: string) {
  const database = db(d1);

  const [projectLevel] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), hasProjectAccess(database, userId)))
    .limit(1);

  if (projectLevel) {
    return (
      (await database.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
          workspaces: {
            orderBy: [asc(workspaces.createdAt)],
          },
        },
      })) ?? null
    );
  }

  const memberWorkspaces = await database
    .select(workspaceColumns)
    .from(workspaces)
    .where(and(eq(workspaces.projectId, projectId), hasWorkspaceMembership(database, userId)))
    .orderBy(asc(workspaces.createdAt));

  if (memberWorkspaces.length === 0) return null;

  const project = await database.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return null;

  return { ...project, workspaces: memberWorkspaces };
}

export async function listWorkspaces(d1: D1Database, projectId: string) {
  return db(d1).query.workspaces.findMany({
    where: eq(workspaces.projectId, projectId),
    orderBy: [asc(workspaces.createdAt)],
  });
}

export async function updateProjectName(d1: D1Database, projectId: string, name: string) {
  const [row] = await db(d1)
    .update(projects)
    .set({ name: name.trim().slice(0, 80), updatedAt: Date.now() })
    .where(eq(projects.id, projectId))
    .returning();
  return row ? rowToProject(row) : null;
}

export async function listAccessibleWorkspaces(
  d1: D1Database,
  args: { projectId: string; userId: string },
) {
  const database = db(d1);
  return database
    .select(workspaceWithProjectSelect)
    .from(workspaces)
    .innerJoin(projects, eq(projects.id, workspaces.projectId))
    .where(and(eq(workspaces.projectId, args.projectId), canAccessWorkspace(database, args.userId)))
    .orderBy(asc(workspaces.createdAt));
}

export async function getProjectWorkspace(d1: D1Database, projectId: string, idOrSlug: string) {
  const row = await db(d1).query.workspaces.findFirst({
    where: and(eq(workspaces.projectId, projectId), workspaceIdOrSlugMatch(idOrSlug)),
  });
  return row ?? null;
}

export async function insertEdge(d1: D1Database, input: InferInsertModel<typeof nodeEdges>) {
  return db(d1).insert(nodeEdges).values(input).returning();
}

export async function deleteEdge(d1: D1Database, args: { edgeId: string; workspaceId: string }) {
  return db(d1)
    .delete(nodeEdges)
    .where(and(eq(nodeEdges.id, args.edgeId), eq(nodeEdges.workspaceId, args.workspaceId)));
}

export async function listWorkspaceEdges(d1: D1Database, workspaceId: string) {
  const rows = await db(d1).query.nodeEdges.findMany({
    where: eq(nodeEdges.workspaceId, workspaceId),
  });
  return rows.map(rowToEdge);
}

export async function listWorkspaceNodes(d1: D1Database, workspaceId: string) {
  const rows = await db(d1).query.nodes.findMany({
    where: eq(nodes.workspaceId, workspaceId),
    with: nodeWithRelations,
    orderBy: [asc(nodes.createdAt)],
  });
  return rows.map((row) => rowToNode(row));
}

async function boardPayload(d1: D1Database, workspace: WorkspaceForBoard) {
  const [nodes, edges] = await Promise.all([
    listWorkspaceNodes(d1, workspace.id),
    listWorkspaceEdges(d1, workspace.id),
  ]);

  return {
    project: rowToProject(workspace.project),
    workspace: rowToWorkspace(workspace),
    nodes,
    edges,
  };
}

export async function loadBoard(d1: D1Database, workspaceId: string) {
  const workspace = await db(d1).query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: { project: true },
  });
  if (!workspace?.project) return null;
  return boardPayload(d1, workspace);
}

export async function loadAccessibleBoard(
  d1: D1Database,
  args: { projectId: string; workspaceId: string; userId: string },
) {
  const workspace = await getProjectWorkspaceByIdOrSlug(d1, args.workspaceId, {
    projectId: args.projectId,
    userId: args.userId,
  });
  if (!workspace) return null;

  const board = await boardPayload(d1, workspace);
  const members = await getWorkspaceRoster(d1, {
    projectId: workspace.project.id,
    workspaceId: workspace.id,
  });
  return { ...board, members };
}

export async function getProjectWorkspaceByIdOrSlug(
  d1: D1Database,
  idOrSlug: string,
  options: { projectId: string; userId: string },
) {
  return findAccessibleWorkspace(
    d1,
    options.userId,
    sqlAnd(eq(workspaces.projectId, options.projectId), workspaceIdOrSlugMatch(idOrSlug)),
  );
}

export async function getWorkspaceForUser(d1: D1Database, workspaceId: string, userId: string) {
  return findAccessibleWorkspace(d1, userId, eq(workspaces.id, workspaceId));
}

export async function touchProject(d1: D1Database, projectId: string) {
  return db(d1).update(projects).set({ updatedAt: Date.now() }).where(eq(projects.id, projectId));
}

export async function createWorkspace(
  d1: D1Database,
  input: Pick<InferInsertModel<typeof workspaces>, "projectId" | "name" | "kind"> & {
    slug: string;
  },
) {
  const [row] = await db(d1)
    .insert(workspaces)
    .values({
      projectId: input.projectId,
      slug: input.slug,
      name: input.name,
      kind: input.kind,
    })
    .returning();
  return row ?? null;
}

export async function updateWorkspaceStatus(
  d1: D1Database,
  workspaceId: string,
  input: Partial<Pick<InferSelectModel<typeof workspaces>, "status" | "statusNote" | "attention">>,
) {
  const [row] = await db(d1)
    .update(workspaces)
    .set({ ...input, updatedAt: Date.now() })
    .where(eq(workspaces.id, workspaceId))
    .returning();
  return row ? rowToWorkspace(row) : null;
}

/** Owner or project_members row — not workspace-only membership. */
export async function userHasProjectAccess(
  d1: D1Database,
  args: { projectId: string; userId: string },
) {
  const database = db(d1);
  const [row] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, args.projectId), hasProjectAccess(database, args.userId)))
    .limit(1);
  return Boolean(row);
}

export async function addMemberToWorkspace(
  d1: D1Database,
  args: { workspaceId: string; userId: string },
) {
  const added = await addMembersToWorkspace(d1, {
    workspaceId: args.workspaceId,
    userIds: [args.userId],
  });
  return added[0] ?? null;
}

export async function addMembersToWorkspace(
  d1: D1Database,
  args: { workspaceId: string; userIds: string[] },
) {
  const uniqueIds = [...new Set(args.userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const database = db(d1);
  const [existing, validUsers] = await Promise.all([
    database.query.workspaceMembers.findMany({
      where: and(
        eq(workspaceMembers.workspaceId, args.workspaceId),
        inArray(workspaceMembers.userId, uniqueIds),
      ),
      columns: { userId: true },
    }),
    database.query.user.findMany({
      where: inArray(user.id, uniqueIds),
      columns: { id: true },
    }),
  ]);

  const existingSet = new Set(existing.map((row) => row.userId));
  const toAdd = validUsers.map((u) => u.id).filter((id) => !existingSet.has(id));
  if (toAdd.length === 0) return [];

  return database
    .insert(workspaceMembers)
    .values(toAdd.map((userId) => ({ workspaceId: args.workspaceId, userId })))
    .returning();
}

export async function getProjectMemberIds(d1: D1Database, projectId: string) {
  const database = db(d1);
  const [project, memberRows] = await Promise.all([
    database.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { ownerId: true },
    }),
    database.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, projectId),
      columns: { userId: true },
    }),
  ]);

  const ids = new Set(memberRows.map((row) => row.userId));
  if (project?.ownerId) ids.add(project.ownerId);
  return [...ids];
}

export async function addMembersToProject(
  d1: D1Database,
  args: { projectId: string; userIds: string[] },
) {
  const uniqueIds = [...new Set(args.userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const database = db(d1);
  const [project, existing, validUsers] = await Promise.all([
    database.query.projects.findFirst({
      where: eq(projects.id, args.projectId),
      columns: { ownerId: true },
    }),
    database.query.projectMembers.findMany({
      where: and(
        eq(projectMembers.projectId, args.projectId),
        inArray(projectMembers.userId, uniqueIds),
      ),
      columns: { userId: true },
    }),
    database.query.user.findMany({
      where: inArray(user.id, uniqueIds),
      columns: { id: true },
    }),
  ]);

  if (!project) return [];

  const existingSet = new Set(existing.map((row) => row.userId));
  existingSet.add(project.ownerId);
  const toAdd = validUsers.map((u) => u.id).filter((id) => !existingSet.has(id));
  if (toAdd.length === 0) return [];

  return database
    .insert(projectMembers)
    .values(toAdd.map((userId) => ({ projectId: args.projectId, userId })))
    .returning();
}

export async function createCommentNode(
  d1: D1Database,
  input: CreateNodeInput & { data: string; commentId?: string },
) {
  const values = nodeInsertValues({ ...input, kind: "comment" });
  const data = input.data.trim();
  const database = db(d1);

  await database.insert(nodes).values(values);

  if (!data) {
    return { id: values.id, commentId: null };
  }

  const commentId = input.commentId ?? crypto.randomUUID();
  await database.insert(comments).values({
    id: commentId,
    threadId: values.id,
    userId: input.authorId,
    data,
  });
  return { id: values.id, commentId };
}

export async function createNoteNode(d1: D1Database, input: CreateNodeInput & { data: string }) {
  const values = nodeInsertValues({ ...input, kind: "note" });
  const database = db(d1);
  return database.batch([
    database.insert(nodes).values(values),
    database.insert(notes).values({
      threadId: values.id,
      data: input.data,
    }),
  ]);
}

export async function createDocumentNode(
  d1: D1Database,
  input: CreateNodeInput & {
    name: string;
    mime: string;
    sizeBytes: number;
    r2Key: string;
  },
) {
  const values = nodeInsertValues({ ...input, kind: "doc" });
  const database = db(d1);
  return database.batch([
    database.insert(nodes).values(values),
    database.insert(documents).values({
      threadId: values.id,
      name: input.name,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      r2Key: input.r2Key,
    }),
  ]);
}

/**
 * Deletes a node and everything hanging off it. Returns the R2 keys of its documents so the
 * caller can remove the stored files, or `null` when the node is not in the workspace.
 */
export async function deleteNode(d1: D1Database, args: { nodeId: string; workspaceId: string }) {
  const node = await getNodeInWorkspace(d1, args);
  if (!node) return null;

  const database = db(d1);
  const docs = await database
    .select({ r2Key: documents.r2Key })
    .from(documents)
    .where(eq(documents.threadId, node.id));

  await database.batch([
    database
      .delete(nodeEdges)
      .where(or(eq(nodeEdges.sourceId, node.id), eq(nodeEdges.targetId, node.id))),
    database.delete(comments).where(eq(comments.threadId, node.id)),
    database.delete(notes).where(eq(notes.threadId, node.id)),
    database.delete(documents).where(eq(documents.threadId, node.id)),
    database.delete(nodes).where(eq(nodes.id, node.id)),
  ]);
  return { r2Keys: docs.map((d) => d.r2Key) };
}

export async function getNodeById(d1: D1Database, nodeId: string) {
  return db(d1).query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });
}

export async function getNodeInWorkspace(
  d1: D1Database,
  args: { nodeId: string; workspaceId: string },
) {
  const node = await getNodeById(d1, args.nodeId);
  return node?.workspaceId === args.workspaceId ? node : null;
}

/** Resolves a node only if it belongs to a workspace of `projectId`. */
export async function getNodeInProject(
  d1: D1Database,
  args: { nodeId: string; projectId: string },
) {
  const [row] = await db(d1)
    .select({ node: nodes })
    .from(nodes)
    .innerJoin(workspaces, eq(workspaces.id, nodes.workspaceId))
    .where(and(eq(nodes.id, args.nodeId), eq(workspaces.projectId, args.projectId)))
    .limit(1);
  return row?.node ?? null;
}

export async function getNodeWithRelations(d1: D1Database, nodeId: string) {
  return db(d1).query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
    with: nodeWithRelations,
  });
}

export async function getNodeDto(d1: D1Database, nodeId: string) {
  const node = await getNodeWithRelations(d1, nodeId);
  return node ? rowToNode(node) : null;
}

export async function getWorkspaceMembers(
  d1: D1Database,
  args: { projectId: string; workspaceId: string },
) {
  const database = db(d1);
  const [workspaceMemberRows, projectMemberRows] = await database.batch([
    database.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, args.workspaceId),
      with: { user: userPreview },
    }),
    database.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, args.projectId),
      with: { user: userPreview },
    }),
  ]);

  return mergeMemberPreviews([workspaceMemberRows, projectMemberRows]);
}

async function getAgentMembers(d1: D1Database): Promise<MemberPreview[]> {
  const rows = await db(d1).query.user.findMany({
    where: eq(user.role, AGENT_ROLE),
    columns: userPreview.columns,
  });
  return rows.map(toMemberPreview);
}

function withAgentsFirst(agents: MemberPreview[], members: MemberPreview[]) {
  const agentIds = new Set(agents.map((a) => a.id));
  return [...agents, ...members.filter((m) => !agentIds.has(m.id))];
}

export async function getWorkspaceRoster(
  d1: D1Database,
  args: { projectId: string; workspaceId: string },
) {
  const [agents, members] = await Promise.all([getAgentMembers(d1), getWorkspaceMembers(d1, args)]);
  return withAgentsFirst(agents, members);
}

export async function getProjectRoster(d1: D1Database, args: { projectId: string }) {
  const database = db(d1);
  const [agents, projectMemberRows, workspaceMemberRows] = await Promise.all([
    getAgentMembers(d1),
    database.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, args.projectId),
      with: { user: userPreview },
    }),
    database
      .select({ user: { id: user.id, name: user.name, image: user.image, role: user.role } })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .innerJoin(user, eq(user.id, workspaceMembers.userId))
      .where(eq(workspaces.projectId, args.projectId)),
  ]);
  const members = mergeMemberPreviews([projectMemberRows, workspaceMemberRows]);
  return withAgentsFirst(agents, members);
}

export async function addCommentToThread(
  d1: D1Database,
  args: {
    message: string;
    threadId: string;
    userId: string;
    workspaceId?: string;
  },
) {
  const thread = await getNodeById(d1, args.threadId);
  if (!thread || thread.kind !== "comment") throw new Error("Thread not found");
  if (args.workspaceId && thread.workspaceId !== args.workspaceId) {
    throw new Error("Thread not found");
  }

  const [result] = await db(d1)
    .insert(comments)
    .values({
      threadId: args.threadId,
      data: args.message,
      userId: args.userId,
    })
    .returning();

  return result;
}

export async function updateNode(
  d1: D1Database,
  args: Partial<Pick<InferInsertModel<typeof nodes>, "title" | "x" | "y">> & {
    nodeId: string;
    data?: string;
  },
) {
  const database = db(d1);
  const [updatedNode] = await database
    .update(nodes)
    .set({
      title: args.title,
      x: args.x,
      y: args.y,
      // Always bump so a body-only edit still has a column to set (drizzle rejects empty sets).
      updatedAt: Date.now(),
    })
    .where(eq(nodes.id, args.nodeId))
    .returning();

  if (!updatedNode) return;

  if (args.data !== undefined && isNodeRowOfKind(updatedNode, "note")) {
    await database
      .update(notes)
      .set({
        data: args.data,
      })
      .where(eq(notes.threadId, args.nodeId));
  }

  return updatedNode;
}

export async function updateReplyComment(
  d1: D1Database,
  args: { replyId: string; message: string; userId: string },
) {
  const database = db(d1);
  const [updatedComment] = await database
    .update(comments)
    .set({
      data: args.message,
    })
    .where(and(eq(comments.id, args.replyId), eq(comments.userId, args.userId)))
    .returning();
  return updatedComment;
}
