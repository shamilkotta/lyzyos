import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

export const nodeKinds = ["doc", "note", "comment"] as const;
export const status = ["in_progress", "complete"] as const;
export const workspaceStatus = [
  "not_started",
  "in_progress",
  "blocked",
  "in_review",
  "complete",
  "ready",
] as const;

export const projects = sqliteTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    status: text("status", { enum: status }).notNull().default("in_progress"),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_projects_owner").on(t.ownerId)],
);

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    status: text("status", { enum: workspaceStatus }).notNull().default("in_progress"),
    statusNote: text("status_note"),
    attention: text("attention"),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_workspaces_project").on(t.projectId)],
);

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_workspace_members_workspace").on(t.workspaceId)],
);

export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_project_members_project").on(t.projectId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    threadId: text("thread_id")
      .notNull()
      .references(() => nodes.id),
    name: text("name").notNull(),
    r2Key: text("r2_key").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_documents_thread").on(t.threadId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    threadId: text("thread_id")
      .notNull()
      .references(() => nodes.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    data: text("text").notNull().default(""),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_comments_thread").on(t.threadId)],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    threadId: text("thread_id")
      .notNull()
      .references(() => nodes.id),
    data: text("text").notNull().default(""),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_notes_thread").on(t.threadId)],
);

export const nodes = sqliteTable(
  "nodes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    kind: text("kind", { enum: nodeKinds }).notNull(),
    title: text("title").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    status: text("status"),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [index("idx_nodes_workspace").on(t.workspaceId)],
);

export const nodeEdges = sqliteTable(
  "node_edges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    sourceId: text("source_id")
      .notNull()
      .references(() => nodes.id),
    targetId: text("target_id")
      .notNull()
      .references(() => nodes.id),
    createdAt: integer("created_at")
      .$defaultFn(() => Date.now())
      .notNull(),
    updatedAt: integer("updated_at")
      .$defaultFn(() => Date.now())
      .$onUpdateFn(() => Date.now())
      .notNull(),
  },
  (t) => [
    index("idx_edges_workspace").on(t.workspaceId),
    uniqueIndex("uq_edges_source_target").on(t.sourceId, t.targetId),
  ],
);

export const projectRelations = relations(projects, ({ one, many }) => ({
  owner: one(user, {
    fields: [projects.ownerId],
    references: [user.id],
  }),
  workspaces: many(workspaces),
  members: many(projectMembers),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(user, {
    fields: [projectMembers.userId],
    references: [user.id],
  }),
}));

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
  project: one(projects, {
    fields: [workspaces.projectId],
    references: [projects.id],
  }),
  nodes: many(nodes),
  edges: many(nodeEdges),
  members: many(workspaceMembers),
}));

export const workspaceMemberRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(user, {
    fields: [workspaceMembers.userId],
    references: [user.id],
  }),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  thread: one(nodes, {
    fields: [documents.threadId],
    references: [nodes.id],
  }),
}));

export const commentRelations = relations(comments, ({ one }) => ({
  thread: one(nodes, {
    fields: [comments.threadId],
    references: [nodes.id],
  }),
  user: one(user, {
    fields: [comments.userId],
    references: [user.id],
  }),
}));

export const noteRelations = relations(notes, ({ one }) => ({
  thread: one(nodes, {
    fields: [notes.threadId],
    references: [nodes.id],
  }),
}));

export const nodeRelations = relations(nodes, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [nodes.workspaceId],
    references: [workspaces.id],
  }),
  author: one(user, {
    fields: [nodes.authorId],
    references: [user.id],
  }),
  documents: many(documents),
  comments: many(comments),
  notes: many(notes),
  outgoingEdges: many(nodeEdges, { relationName: "edge_source" }),
  incomingEdges: many(nodeEdges, { relationName: "edge_target" }),
}));

export const nodeEdgeRelations = relations(nodeEdges, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [nodeEdges.workspaceId],
    references: [workspaces.id],
  }),
  source: one(nodes, {
    fields: [nodeEdges.sourceId],
    references: [nodes.id],
    relationName: "edge_source",
  }),
  target: one(nodes, {
    fields: [nodeEdges.targetId],
    references: [nodes.id],
    relationName: "edge_target",
  }),
}));

export const schema = {
  projects,
  workspaces,
  workspaceMembers,
  documents,
  comments,
  notes,
  nodes,
  nodeEdges,
  projectRelations,
  workspaceRelations,
  workspaceMemberRelations,
  documentRelations,
  commentRelations,
  noteRelations,
  nodeRelations,
  nodeEdgeRelations,
  projectMembers,
  projectMembersRelations,
};
