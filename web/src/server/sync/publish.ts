import "server-only";

import type { SyncEvent } from "@lyzyos/db";
import type { AppEnv } from "../env";

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
