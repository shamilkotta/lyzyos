import {
  listWorkspaces,
  type BoardEdge,
  type NodeDto,
  type ProjectDto,
  type SyncEvent,
  type WorkspaceDto,
} from "@lyzyos/db";

function isDurablePublisher(value: unknown): value is {
  publish(
    workspaceId: string,
    event: SyncEvent,
    originClientId?: string | null,
  ): Promise<{ seq: number }>;
} {
  return !!value && typeof (value as any).publish === "function";
}

const AGENT_ORIGIN_CLIENT = "lyzy-agent";

async function publishSyncEvent(env: Env, workspaceId: string, event: SyncEvent) {
  try {
    if (!env.WORKSPACE_SYNC) return;
    const stub = env.WORKSPACE_SYNC.getByName(workspaceId);
    if (!isDurablePublisher(stub)) return;
    await stub.publish(workspaceId, event, AGENT_ORIGIN_CLIENT);
  } catch (err) {
    console.error("sync publish failed", err);
  }
}

export async function publishNodeUpserted(env: Env, workspaceId: string, node: NodeDto) {
  await publishSyncEvent(env, workspaceId, {
    type: "node.upserted",
    node,
  });
}

export async function publishEdgeUpserted(env: Env, workspaceId: string, edge: BoardEdge) {
  await publishSyncEvent(env, workspaceId, {
    type: "edge.upserted",
    edge,
  });
}

/** Project-level changes fan out to every workspace room of the project. */
export async function publishProjectUpdated(env: Env, project: ProjectDto) {
  const workspaces = await listWorkspaces(env.DB, project.id);
  await Promise.all(
    workspaces.map((w) => publishSyncEvent(env, w.id, { type: "project.updated", project })),
  );
}

export async function publishWorkspaceUpdated(env: Env, workspace: WorkspaceDto) {
  await publishSyncEvent(env, workspace.id, { type: "workspace.updated", workspace });
}
