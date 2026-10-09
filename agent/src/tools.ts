import {
  addCommentToThread,
  addMemberToWorkspace,
  createCommentNode,
  createNoteNode,
  createWorkspace,
  getDocumentInProject,
  getNodeDto,
  getNodeInProject,
  getObject,
  getProjectWorkspace,
  getWorkspaceMembers,
  insertEdge,
  isTextLikeFile,
  listNodeEdges,
  listUsers,
  listWorkspaceEdges,
  listWorkspaceNodes,
  listWorkspaces,
  updateNode,
  updateProjectName,
  updateReplyComment,
  updateWorkspaceStatus,
  workspaceStatus,
  type NodeDto,
} from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Lyzy } from "./agent";
import {
  publishEdgeUpserted,
  publishNodeUpserted,
  publishProjectUpdated,
  publishWorkspaceUpdated,
} from "./publish";

export const toolSessionSchema = z.object({
  projectId: z.string().min(1),
  workspaceId: z.string().min(1),
  threadId: z.string().min(1),
});

const nonEmptyString = z.string().trim().nonempty();
const optionalString = z.string().trim().optional();

export type ToolSession = z.infer<typeof toolSessionSchema>;

/** Horizontal gap used when the model does not choose a position for a new node. */
const NODE_COLUMN_WIDTH = 300;
const NODE_ROW_HEIGHT = 160;

export function createTools(this: Lyzy) {
  const env = this.env;

  /**
   * Every tool resolves records through the session's project, so the model can only ever
   * reach workspaces and nodes inside the project this agent instance belongs to.
   */
  async function resolveWorkspace(context: ToolSession, workspaceId?: string) {
    return getProjectWorkspace(env.DB, context.projectId, workspaceId ?? context.workspaceId);
  }

  async function resolveNode(context: ToolSession, nodeId: string) {
    return getNodeInProject(env.DB, { nodeId, projectId: context.projectId });
  }

  /**
   * Serializes publish calls so events reach WebSocket clients one at a time even
   * when the AI SDK executes multiple tool calls in parallel within a single step.
   * Without this, all tools in a step fire publishNodeUpserted concurrently and the
   * client sees every change land at once instead of incrementally.
   */
  // let publishTail = Promise.resolve();
  // function enqueuePublish(fn: () => Promise<void>) {
  //   publishTail = publishTail.then(fn, fn);
  //   return publishTail;
  // }

  // Tracks the reply created by set_status so subsequent calls update in place.
  let statusReplyId: string | null = null;

  return {
    current_context: tool({
      description:
        "Get details about the current workspace and thread — id, name, kind, status, and other metadata. Use this when you need the current workspace or thread details for other operations.",
      inputSchema: z.object({}),
      contextSchema: toolSessionSchema,
      execute: async (_input, { context }) => {
        const [workspace, thread] = await Promise.all([
          resolveWorkspace(context),
          resolveNode(context, context.threadId),
        ]);
        return {
          ok: true,
          workspace: workspace
            ? {
                workspaceId: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                kind: workspace.kind,
                status: workspace.status,
                statusNote: workspace.statusNote,
                attention: workspace.attention,
              }
            : null,
          thread: thread
            ? {
                threadId: thread.id,
                kind: thread.kind,
                title: thread.title,
                workspaceId: thread.workspaceId,
              }
            : null,
        };
      },
    }),
    all_project_workspaces: tool({
      description: "Get list of workspaces on this current project",
      inputSchema: z.object({}),
      contextSchema: toolSessionSchema,
      execute: async (_input, { context }) => {
        const rows = await listWorkspaces(env.DB, context.projectId);
        return rows.map((w) => ({
          workspaceId: w.id,
          slug: w.slug,
          name: w.name,
          kind: w.kind,
          status: w.status,
          current: w.id === context.workspaceId,
        }));
      },
    }),
    all_workspace_nodes: tool({
      description: `Get list of all nodes in the workspace canvas. usefull to get full picture of workspace and current standing of project
       Also you will get idea how canvas layout right now for this workspace`,
      inputSchema: z.object({
        workspaceId: optionalString.describe(
          `Workspace id where you want to get the nodes. Optional, if omitted, return nodes for the same workspace where this context / interaction is started`,
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const workspace = await resolveWorkspace(context, input.workspaceId);
        if (!workspace) return { ok: false, error: "Workspace not found" };
        const nodes = await listWorkspaceNodes(env.DB, workspace.id);
        return { ok: true, workspaceId: workspace.id, nodes: nodes.map(toToolNode) };
      },
    }),
    all_workspace_edges: tool({
      description: `Get list of all node edges in the workspace canvas. usefull to get idea of how data related each other, how nodes are related each other`,
      inputSchema: z.object({
        workspaceId: optionalString.describe(
          `Workspace id where you want to get the node edges. Optional, if omitted, return edges from the same workspace where this context / interaction is started`,
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const workspace = await resolveWorkspace(context, input.workspaceId);
        if (!workspace) return { ok: false, error: "Workspace not found" };
        const edges = await listWorkspaceEdges(env.DB, workspace.id);
        return { ok: true, workspaceId: workspace.id, edges };
      },
    }),
    get_node_edges: tool({
      description: `Get all edges connected to a specific node — both incoming edges (where the node is the target) and outgoing edges (where the node is the source). Useful to understand how a node relates to others on the canvas.`,
      inputSchema: z.object({
        nodeId: optionalString.describe(
          "The node/thread id whose edges you want to retrieve, Optional, if omitted return edges for the current thread/node",
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const node = await resolveNode(context, input.nodeId ?? context.threadId);
        if (!node) return { ok: false, error: "Node not found" };
        const edges = await listNodeEdges(env.DB, node.id);
        const incoming = edges.filter((e) => e.targetId === node.id);
        const outgoing = edges.filter((e) => e.sourceId === node.id);
        return { ok: true, nodeId: node.id, incoming, outgoing };
      },
    }),
    add_node: tool({
      description: `Add one node to a workspace canvas: a note or a comment thread. Call it once per node.
          Use comment to start a new interaction / ask a question / chat with team members.
          Use note to share findings or write down something helpful for other team members.
          Returns the created node, including its nodeId (use it with add_edge or reply_comment).`,
      inputSchema: z.object({
        kind: z.enum(["note", "comment"]).describe("Node type you want to add, comment or note"),
        title: optionalString.describe(
          "Short title for a note node, (optional, ignored for comments)",
        ),
        data: nonEmptyString.describe(
          "Note content, or the opening message of a comment thread. Markdown is supported",
        ),
        x: z.number().optional().describe("X position of node on the workspace canvas, (optional)"),
        y: z.number().optional().describe("Y position of node on the workspace canvas, (optional)"),
        workspaceId: optionalString.describe(
          "Workspace id where you want to add node. Optional, if omitted node will add on the same workspace where this context / interaction is started",
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const workspace = await resolveWorkspace(context, input.workspaceId);
        if (!workspace) return { ok: false, error: "Workspace not found" };

        let { x, y } = input;
        if (x === undefined || y === undefined) {
          // Auto-place below the right-most column so new nodes never overlap existing ones.
          const existing = await listWorkspaceNodes(env.DB, workspace.id);
          const maxX = existing.reduce((max, n) => Math.max(max, n.x), 40 - NODE_COLUMN_WIDTH);
          const column = existing.filter((n) => n.x === maxX);
          const maxY = column.reduce((max, n) => Math.max(max, n.y), 40 - NODE_ROW_HEIGHT);
          x ??= existing.length === 0 ? 40 : maxX;
          y ??= existing.length === 0 ? 40 : maxY + NODE_ROW_HEIGHT;
        }

        const nodeId = crypto.randomUUID();
        const base = { id: nodeId, workspaceId: workspace.id, authorId: env.AGENT_ID, x, y };
        if (input.kind === "note") {
          await createNoteNode(env.DB, { ...base, title: input.title ?? "", data: input.data });
        } else {
          await createCommentNode(env.DB, { ...base, title: "", data: input.data });
        }

        const node = await getNodeDto(env.DB, nodeId);
        if (!node) return { ok: false, error: "Failed to create node" };
        await publishNodeUpserted(env, workspace.id, node);
        return { ok: true, node: toToolNode(node) };
      },
    }),
    add_edge: tool({
      description: `Connect two related nodes with an edge. Call it once per edge. Both nodes must be in the same workspace`,
      inputSchema: z.object({
        sourceNodeId: nonEmptyString.describe("Source node id where the edge starts"),
        targetNodeId: nonEmptyString.describe("Target node id where the edge ends"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        if (input.sourceNodeId === input.targetNodeId) {
          return { ok: false, error: "Cannot connect a node to itself" };
        }
        const [source, target] = await Promise.all([
          resolveNode(context, input.sourceNodeId),
          resolveNode(context, input.targetNodeId),
        ]);
        if (!source || !target) return { ok: false, error: "Node not found" };
        if (source.workspaceId !== target.workspaceId) {
          return { ok: false, error: "Nodes are in different workspaces" };
        }

        const [rows, error] = await tryCatch(
          insertEdge(env.DB, {
            workspaceId: source.workspaceId,
            sourceId: source.id,
            targetId: target.id,
          }),
        );
        const edge = rows?.[0];
        if (error || !edge) return { ok: false, error: "Edge already exists" };

        const dto = { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId };
        await publishEdgeUpserted(env, edge.workspaceId, dto);
        return { ok: true, edge: dto };
      },
    }),
    update_project_title: tool({
      description: `Rename the project. NOT allowed unless a team member explicitly asks you to set or change the project title
          (the project kickoff counts as such a request). Never call it on your own initiative.`,
      inputSchema: z.object({
        title: nonEmptyString
          .max(80)
          .describe("New project title, short and specific (max 80 characters)"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const project = await updateProjectName(env.DB, context.projectId, input.title);
        if (!project) return { ok: false, error: "Project not found" };
        await publishProjectUpdated(env, project);
        return { ok: true, title: project.name };
      },
    }),
    update_node: tool({
      description: "Update title of a node or update note",
      inputSchema: z.object({
        title: optionalString.describe("Updated title of the node, (optional)"),
        data: optionalString.describe("Updated note for note type node, (optional)"),
        nodeId: nonEmptyString.describe("Node that need to be updated"),
        x: z.number().optional().describe("X position of node on the workspace canvas, (optional)"),
        y: z.number().optional().describe("Y position of node on the workspace canvas, (optional)"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        if (!(await resolveNode(context, input.nodeId))) {
          return { ok: false, error: "Node not found" };
        }

        const updated = await updateNode(env.DB, input);
        if (!updated) {
          return { ok: false, error: "Node not found" };
        }

        const node = await getNodeDto(env.DB, input.nodeId);
        if (!node) {
          return { ok: false, error: "Node not found" };
        }

        await publishNodeUpserted(env, node.workspaceId, node);

        return { ok: true, node: toToolNode(node) };
      },
    }),
    reply_comment: tool({
      description:
        "Reply on another comment node, or you can use this tool to send multiple messages/reply to the same thread you are in",
      inputSchema: z.object({
        threadId: optionalString.describe(
          "Comment node id to which you want to reply, optional, if omitted use the thread id from the current contexts",
        ),
        message: nonEmptyString.describe("Your reply"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const thread = await resolveNode(context, input.threadId ?? context.threadId);
        if (!thread || thread.kind !== "comment") {
          return { ok: false, error: "Comment thread not found" };
        }

        const comment = await addCommentToThread(env.DB, {
          threadId: thread.id,
          message: input.message,
          userId: env.AGENT_ID,
        });

        const node = await getNodeDto(env.DB, thread.id);
        if (node) {
          await publishNodeUpserted(env, node.workspaceId, node);
        }

        return {
          ok: true,
          replyId: comment.id,
          threadId: comment.threadId,
          message: comment.data,
          createdAt: comment.createdAt,
        };
      },
    }),
    set_status: tool({
      description: `Post or update your visible status on the current thread.
        Call this as your FIRST tool call before doing any other work — post a brief message about what you are about to do.
        Call it again whenever you have meaningful progress to share.
        Call it one final time with a summary when the work is complete, then return "${`<--SKIP->`}" as your final text so this status message serves as your reply.
        If the request is purely conversational (no tool calls at all), skip this and reply directly with text.`,
      inputSchema: z.object({
        message: nonEmptyString.describe(
          "Brief status message, e.g. 'On it! Creating 3 notes...' or 'Done! Created all notes and linked them.'",
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const thread = await resolveNode(context, context.threadId);
        if (!thread || thread.kind !== "comment") {
          // Kickoff flow or non-comment thread — skip silently.
          return { ok: true, skipped: true };
        }

        if (statusReplyId) {
          const reply = await updateReplyComment(env.DB, {
            replyId: statusReplyId,
            message: input.message,
            userId: env.AGENT_ID,
          });
          if (!reply) return { ok: false, error: "Status reply not found" };
          const node = await getNodeDto(env.DB, thread.id);
          if (node) {
            const workspace = await resolveWorkspace(context, node.workspaceId);
            if (workspace) await publishNodeUpserted(env, node.workspaceId, node);
          }
          return { ok: true, updated: true };
        } else {
          const comment = await addCommentToThread(env.DB, {
            threadId: thread.id,
            message: input.message,
            userId: env.AGENT_ID,
          });
          statusReplyId = comment.id;
          const node = await getNodeDto(env.DB, thread.id);
          if (node) {
            await publishNodeUpserted(env, node.workspaceId, node);
          }
          return { ok: true, created: true };
        }
      },
    }),
    list_users: tool({
      description: `List all users in the org directory (id, name, role).
        Use this get user id or figure out user from the details you have`,
      inputSchema: z.object({}),
      contextSchema: toolSessionSchema,
      execute: async () => {
        const users = await listUsers(env.DB);
        return {
          ok: true,
          users: users.map((u) => ({
            userId: u.id,
            name: u.name,
            role: u.role,
          })),
        };
      },
    }),
    list_workspace_members: tool({
      description: "Members that are part of the workspace",
      inputSchema: z.object({
        workspaceId: optionalString.describe(
          "Workspace id for which the memebrs are listed. Optional, if omitted return members of the same workspace where this context / interaction is started",
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const workspace = await resolveWorkspace(context, input.workspaceId);
        if (!workspace) return { ok: false, error: "Workspace not found" };
        const members = await getWorkspaceMembers(env.DB, {
          projectId: context.projectId,
          workspaceId: workspace.id,
        });
        return { ok: true, members };
      },
    }),
    create_workspace: tool({
      description: `Create a new workspace under the current project. Use this to create a new department or work area.
        Returns the created workspace including its workspaceId.`,
      inputSchema: z.object({
        name: nonEmptyString.max(80).describe("Name of the new workspace"),
        kind: optionalString.describe(
          "Kind/type of the workspace, e.g. 'creative', 'compliance' (optional)",
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const slug = input.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        const workspace = await createWorkspace(env.DB, {
          projectId: context.projectId,
          name: input.name,
          kind: input.kind ?? "workspace",
          slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`,
        });
        if (!workspace) return { ok: false, error: "Failed to create workspace" };
        return {
          ok: true,
          workspace: { workspaceId: workspace.id, name: workspace.name, kind: workspace.kind },
        };
      },
    }),
    add_member_to_workspace: tool({
      description: `Add a user to a workspace. You can use list_users, list_workspace_members tools if needed to get full details of the user and workspace`,
      inputSchema: z.object({
        userId: nonEmptyString.describe("The user id to add to the workspace"),
        workspaceId: optionalString.describe(
          "Workspace id to add the member to. Optional, if omitted uses the current workspace",
        ),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const workspace = await resolveWorkspace(context, input.workspaceId);
        if (!workspace) return { ok: false, error: "Workspace not found" };
        await addMemberToWorkspace(env.DB, { workspaceId: workspace.id, userId: input.userId });
        return { ok: true, workspaceId: workspace.id, userId: input.userId };
      },
    }),
    update_workspace_status: tool({
      description: `Update the status, status note, or attention field of a workspace.
        - status: the overall state of the workspace
        - statusNote: a short text (≤500 chars) describing current progress or what has been done
        - attention: a short text (≤500 chars) describing what is pending or what other members need to act on`,
      inputSchema: z.object({
        workspaceId: optionalString.describe(
          "Workspace id to update. Optional, if omitted updates the current workspace",
        ),
        status: z.enum(workspaceStatus).optional().describe("New status for the workspace"),
        statusNote: z
          .string()
          .trim()
          .max(500)
          .optional()
          .describe("What has been completed or current state (optional)"),
        attention: z
          .string()
          .trim()
          .max(500)
          .optional()
          .describe("What is pending or needs attention from team (optional)"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const workspace = await resolveWorkspace(context, input.workspaceId);
        if (!workspace) return { ok: false, error: "Workspace not found" };
        const updated = await updateWorkspaceStatus(env.DB, workspace.id, {
          status: input.status,
          statusNote: input.statusNote ?? undefined,
          attention: input.attention ?? undefined,
        });
        if (!updated) return { ok: false, error: "Update failed" };
        await publishWorkspaceUpdated(env, updated);
        return {
          ok: true,
          workspace: {
            workspaceId: updated.id,
            status: updated.status,
            statusNote: updated.statusNote,
            attention: updated.attention,
          },
        };
      },
    }),
    update_reply_comment: tool({
      description: `Update the reply comment you already sent using reply_comment tool.`,
      inputSchema: z.object({
        replyId: nonEmptyString.describe("Reply id to update"),
        message: nonEmptyString.describe("Updated message for the reply"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const reply = await updateReplyComment(env.DB, {
          replyId: input.replyId,
          message: input.message,
          userId: env.AGENT_ID,
        });
        if (!reply) return { ok: false, error: "Reply not found" };

        const node = await getNodeDto(env.DB, reply.threadId);
        // Verify the thread node's workspace belongs to this project before publishing.
        if (node) {
          const workspace = await resolveWorkspace(context, node.workspaceId);
          if (workspace) await publishNodeUpserted(env, node.workspaceId, node);
        }

        return {
          ok: true,
          replyId: reply.id,
          threadId: reply.threadId,
          message: reply.data,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
        };
      },
    }),
    read_document: tool({
      description: `Read the content of a document file stored as a doc node in the workspace.
        Use this to access briefs, brand guidelines, images, or any file uploaded as a document.
        Use all_workspace_nodes to discover doc nodes and obtain their docId first.`,
      inputSchema: z.object({
        docId: nonEmptyString.describe("The docId of the document to read (from a doc node)"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const doc = await getDocumentInProject(env.DB, {
          docId: input.docId,
          projectId: context.projectId,
        });
        if (!doc) return { ok: false as const, error: "Document not found" };

        const isImage = doc.mime.toLowerCase().startsWith("image/");
        const isText = isTextLikeFile(doc.mime, doc.name);

        if (!isImage && !isText) {
          return {
            ok: false as const,
            error: `File type "${doc.mime}" cannot be read. Only image/* and text-like files are supported.`,
          };
        }

        const obj = await getObject(env.FILES, doc.r2Key);
        if (!obj) return { ok: false as const, error: "File not found in storage" };

        const bytes = await obj.arrayBuffer();

        if (isImage) {
          return {
            ok: true as const,
            kind: "image" as const,
            docId: doc.id,
            name: doc.name,
            mime: doc.mime,
            bytes: new Uint8Array(bytes),
          };
        }

        return {
          ok: true as const,
          kind: "text" as const,
          docId: doc.id,
          name: doc.name,
          mime: doc.mime,
          text: new TextDecoder().decode(bytes),
        };
      },
      toModelOutput: ({ output }) => {
        if (!output.ok) {
          return { type: "json", value: { error: output.error } };
        }
        if (output.kind === "image") {
          return {
            type: "content",
            value: [
              {
                type: "file",
                data: { type: "data", data: output.bytes },
                mediaType: output.mime,
                filename: output.name,
              },
            ],
          };
        }
        return {
          type: "content",
          value: [
            {
              type: "text",
              text: `<file name="${output.name}" mime="${output.mime}">\n${output.text}\n</file>`,
            },
          ],
        };
      },
    }),
  } satisfies ToolSet;
}

/** Compact node view for the model: drops render-only fields like preview kind. */
function toToolNode(node: NodeDto) {
  const base = {
    nodeId: node.id,
    workspaceId: node.workspaceId,
    kind: node.kind,
    title: node.title,
    author: `${node.authorName} (${node.authorKind})`,
    x: node.x,
    y: node.y,
    updatedAt: node.updatedAt,
  };
  switch (node.kind) {
    case "note":
      return { ...base, data: node.body };
    case "comment":
      return {
        ...base,
        message: node.body,
        replies: node.replies.map((r) => ({
          author: `${r.authorName} (${r.authorKind})`,
          message: r.body,
        })),
      };
    case "doc":
      return { ...base, docId: node.docId, fileName: node.body, mime: node.mime };
  }
}

export type AgentTools = ReturnType<typeof createTools>;

function isToolName(name: string, tools: AgentTools): name is keyof AgentTools {
  return name in tools;
}

export function toolsContextFor(session: ToolSession, tools: AgentTools) {
  const ctx: { [K in keyof AgentTools]?: ToolSession } = {};
  for (const name of Object.keys(tools)) {
    if (!isToolName(name, tools)) continue;
    ctx[name] = session;
  }
  return ctx as { [K in keyof AgentTools]: ToolSession };
}
