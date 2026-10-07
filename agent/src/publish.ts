import type { NodeDto, NodeWithRelations, SyncEvent } from "@lyzyos/db";
import { getProject, listWorkspaces, loadBoard, rowToNode, rowToProject } from "@lyzyos/db";

type WorkspaceSyncPublisher = {
  publish(
    workspaceId: string,
    event: SyncEvent,
    originClientId?: string | null,
  ): Promise<{ seq: number }>;
};

const AGENT_ORIGIN_CLIENT = "lyzy-agent";

function asNodeDto(node: NodeDto | NodeWithRelations): NodeDto {
  if ("authorKind" in node && "body" in node && typeof node.body === "string") {
    return node as NodeDto;
  }
  return rowToNode(node);
}

export async function publishSyncEvent(
  env: Env,
  workspaceId: string,
  event: SyncEvent,
): Promise<void> {
  try {
    if (!env.WORKSPACE_SYNC) return;
    const stub = env.WORKSPACE_SYNC.getByName(workspaceId) as unknown as WorkspaceSyncPublisher;
    await stub.publish(workspaceId, event, AGENT_ORIGIN_CLIENT);
  } catch (err) {
    console.error("sync publish failed", err);
  }
}

export async function publishNodeUpserted(
  env: Env,
  workspaceId: string,
  node: NodeDto | NodeWithRelations,
): Promise<void> {
  await publishSyncEvent(env, workspaceId, {
    type: "node.upserted",
    node: asNodeDto(node),
  });
}

export async function publishEdgeUpserted(
  env: Env,
  workspaceId: string,
  edge: { id: string; sourceId: string; targetId: string },
): Promise<void> {
  await publishSyncEvent(env, workspaceId, { type: "edge.upserted", edge });
}

export async function publishProjectUpdated(
  env: Env,
  projectId: string,
  workspaceId?: string,
): Promise<void> {
  const project = await getProject(env.DB, projectId);
  if (!project) return;
  const targets = workspaceId
    ? [workspaceId]
    : (await listWorkspaces(env.DB, projectId)).map((w) => w.id);
  const event: SyncEvent = {
    type: "project.updated",
    project: rowToProject(project),
  };
  await Promise.all(targets.map((id) => publishSyncEvent(env, id, event)));
}

export async function publishBoardReplace(env: Env, workspaceId: string): Promise<void> {
  const board = await loadBoard(env.DB, workspaceId);
  if (!board) return;
  await publishSyncEvent(env, workspaceId, {
    type: "board.replace",
    board: {
      project: board.project,
      workspace: board.workspace,
      nodes: board.nodes,
      edges: board.edges,
    },
  });
}
