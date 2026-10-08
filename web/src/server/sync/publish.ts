import "server-only";

import type { BoardEdge, NodeDto, SyncEvent, WorkspaceDto } from "@lyzyos/db";
import type { AppEnv } from "../env";

export function clientIdFromRequest(request: Request) {
  const header = request.headers.get("X-Client-Id")?.trim();
  return header && header.length > 0 ? header : null;
}

/** RPC surface of `WorkspaceSync` (lives in the api worker, so the binding is untyped here). */
type WorkspaceSyncRpc = {
  publish(
    workspaceId: string,
    event: SyncEvent,
    originClientId: string | null,
  ): Promise<{ seq: number }>;
};

/** Fans an event out to the workspace's sync room via the api worker's Durable Object. */
export async function publishSyncEvent(
  env: AppEnv,
  workspaceId: string,
  event: SyncEvent,
  originClientId: string | null = null,
) {
  try {
    const stub = env.WORKSPACE_SYNC.getByName(workspaceId) as unknown as WorkspaceSyncRpc;
    await stub.publish(workspaceId, event, originClientId);
  } catch (err) {
    // Realtime is best-effort; the write already succeeded and clients resync on reconnect.
    console.warn("sync publish failed", err);
  }
}

export async function publishNodeUpserted(
  env: AppEnv,
  workspaceId: string,
  node: NodeDto,
  originClientId: string | null = null,
) {
  await publishSyncEvent(env, workspaceId, { type: "node.upserted", node }, originClientId);
}

export async function publishNodeRemoved(
  env: AppEnv,
  workspaceId: string,
  nodeId: string,
  originClientId: string | null = null,
) {
  await publishSyncEvent(env, workspaceId, { type: "node.removed", nodeId }, originClientId);
}

export async function publishEdgeUpserted(
  env: AppEnv,
  workspaceId: string,
  edge: BoardEdge,
  originClientId: string | null = null,
) {
  await publishSyncEvent(env, workspaceId, { type: "edge.upserted", edge }, originClientId);
}

export async function publishEdgeRemoved(
  env: AppEnv,
  workspaceId: string,
  edgeId: string,
  originClientId: string | null = null,
) {
  await publishSyncEvent(env, workspaceId, { type: "edge.removed", edgeId }, originClientId);
}

export async function publishWorkspaceUpdated(
  env: AppEnv,
  workspace: WorkspaceDto,
  originClientId: string | null = null,
) {
  await publishSyncEvent(
    env,
    workspace.id,
    { type: "workspace.updated", workspace },
    originClientId,
  );
}
