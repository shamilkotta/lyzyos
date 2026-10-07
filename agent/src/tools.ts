import {
  addCommentToThread,
  createCommentNode,
  createNoteNode,
  getNodeDto,
  getNodeInProject,
  getProjectWorkspace,
  getWorkspaceMembers,
  insertEdge,
  listWorkspaceEdges,
  listWorkspaceNodes,
  listWorkspaces,
  updateNode,
  type NodeDto,
} from "@lyzyos/db";
import { tryCatch } from "@lyzyos/utils";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Lyzy } from "./agent";
import { publishEdgeUpserted, publishNodeUpserted } from "./publish";

export const toolSessionSchema = z.object({
  projectId: z.string().min(1),
  workspaceId: z.string().min(1),
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

  return {
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
        const nodes = await listWorkspaceNodes(env.DB, workspace.id, env.AGENT_ID);
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
    add_node: tool({
      description: `Add a node in the workspace. either note node or comment node. use it depending on what you want to add
          use comment for start new interaction / ask question / chat with team members.
          use note share your findings, note down something that will be helpful other team members ...etc`,
      inputSchema: z
        .array(
          z.object({
            title: optionalString.describe("Short title for a note node, (optional)"),
            data: nonEmptyString.describe(
              "Note / message / question of what ever content you want to add in the node",
            ),
            x: z
              .number()
              .optional()
              .describe("X position of node on the workspace canvas, (optional)"),
            y: z
              .number()
              .optional()
              .describe("Y position of node on the workspace canvas, (optional)"),
            workspaceId: optionalString.describe(
              "Workspace id where you want to add node. Optional, if omitted node will add on the same workspace where this context / interaction is started",
            ),
            kind: z
              .enum(["note", "comment"])
              .describe("Node type you want to add, comment or note"),
          }),
        )
        .nonempty(),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const results = [];
        // Auto-placed nodes go in a fresh column right of everything already on each canvas.
        const autoSlots = new Map<string, { x: number; row: number }>();

        for (const item of input) {
          const workspace = await resolveWorkspace(context, item.workspaceId);
          if (!workspace) {
            results.push({ ok: false, error: "Workspace not found" });
            continue;
          }

          let { x, y } = item;
          if (x === undefined || y === undefined) {
            let slot = autoSlots.get(workspace.id);
            if (!slot) {
              const existing = await listWorkspaceNodes(env.DB, workspace.id, env.AGENT_ID);
              const maxX = existing.reduce((max, n) => Math.max(max, n.x), -NODE_COLUMN_WIDTH);
              slot = { x: maxX + NODE_COLUMN_WIDTH, row: 0 };
              autoSlots.set(workspace.id, slot);
            }
            x ??= slot.x;
            y ??= 40 + slot.row * NODE_ROW_HEIGHT;
            slot.row += 1;
          }

          const nodeId = crypto.randomUUID();
          const base = {
            id: nodeId,
            workspaceId: workspace.id,
            authorId: env.AGENT_ID,
            x,
            y,
          };
          if (item.kind === "note") {
            await createNoteNode(env.DB, { ...base, title: item.title ?? "", data: item.data });
          } else {
            await createCommentNode(env.DB, { ...base, title: "", data: item.data });
          }

          const node = await getNodeDto(env.DB, nodeId, env.AGENT_ID);
          if (!node) {
            results.push({ ok: false, error: "Failed to create node" });
            continue;
          }
          await publishNodeUpserted(env, workspace.id, node);
          results.push({ ok: true, node: toToolNode(node) });
        }

        return results;
      },
    }),
    add_edge: tool({
      description: `Add edges between source and target nodes. connect related data / nodes. Both nodes must be in the same workspace`,
      inputSchema: z
        .array(
          z.object({
            sourceNodeId: nonEmptyString.describe("Source node id where edge stat from"),
            targetNodeId: nonEmptyString.describe("Target node id where edge ends"),
          }),
        )
        .nonempty(),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const results = [];
        for (const item of input) {
          if (item.sourceNodeId === item.targetNodeId) {
            results.push({ ok: false, error: "Cannot connect a node to itself" });
            continue;
          }
          const [source, target] = await Promise.all([
            resolveNode(context, item.sourceNodeId),
            resolveNode(context, item.targetNodeId),
          ]);
          if (!source || !target) {
            results.push({ ok: false, error: "Node not found" });
            continue;
          }
          if (source.workspaceId !== target.workspaceId) {
            results.push({ ok: false, error: "Nodes are in different workspaces" });
            continue;
          }

          const [rows, error] = await tryCatch(
            insertEdge(env.DB, {
              workspaceId: source.workspaceId,
              sourceId: source.id,
              targetId: target.id,
            }),
          );
          const edge = rows?.[0];
          if (error || !edge) {
            results.push({ ok: false, error: "Edge already exists" });
            continue;
          }

          const dto = { id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId };
          await publishEdgeUpserted(env, edge.workspaceId, dto);
          results.push({ ok: true, edge: dto });
        }
        return results;
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

        const node = await getNodeDto(env.DB, input.nodeId, env.AGENT_ID);
        if (!node) {
          return { ok: false, error: "Node not found" };
        }

        await publishNodeUpserted(env, node.workspaceId, node);

        return { ok: true, node: toToolNode(node) };
      },
    }),
    reply_comment: tool({
      description: "Reply on another comment node",
      inputSchema: z.object({
        threadId: nonEmptyString.describe("Comment node id to which you want to reply"),
        message: nonEmptyString.describe("Your reply"),
      }),
      contextSchema: toolSessionSchema,
      execute: async (input, { context }) => {
        const thread = await resolveNode(context, input.threadId);
        if (!thread || thread.kind !== "comment") {
          return { ok: false, error: "Comment thread not found" };
        }

        const comment = await addCommentToThread(env.DB, {
          threadId: thread.id,
          message: input.message,
          userId: env.AGENT_ID,
        });

        const node = await getNodeDto(env.DB, thread.id, env.AGENT_ID);
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
      return { ...base, fileName: node.body, mime: node.mime };
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
