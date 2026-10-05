import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const planningNodeKinds = ["brief", "doc", "note", "question", "summary", "answer"] as const;

export const authorKinds = ["human", "agent"] as const;

export const planningStatuses = ["in_progress", "complete"] as const;

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    brief: text("brief").notNull().default(""),
    /** Better Auth user id (default human until real sessions exist). */
    ownerId: text("owner_id").notNull(),
    threadId: text("thread_id"),
    planningStatus: text("planning_status", { enum: planningStatuses })
      .notNull()
      .default("in_progress"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_projects_owner").on(t.ownerId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    name: text("name").notNull(),
    r2Key: text("r2_key").notNull(),
    mime: text("mime"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    textExtract: text("text_extract").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_documents_project").on(t.projectId)],
);

export const planningNodes = sqliteTable(
  "planning_nodes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    kind: text("kind", { enum: planningNodeKinds }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    authorKind: text("author_kind", { enum: authorKinds }).notNull(),
    authorName: text("author_name").notNull().default(""),
    status: text("status"),
    meta: text("meta"),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_nodes_project").on(t.projectId)],
);

export const nodeEdges = sqliteTable(
  "node_edges",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
  },
  (t) => [index("idx_edges_project").on(t.projectId)],
);

export const schema = {
  projects,
  documents,
  planningNodes,
  nodeEdges,
};
