import type { SyncEvent } from "@lyzyos/db";

export async function publishSyncEvent(
  env: Env,
  projectId: string,
  event: SyncEvent,
  originClientId: string | null = null,
): Promise<void> {
  const stub = env.WORKSPACE_SYNC.getByName(projectId);
  await stub.publish(projectId, event, originClientId);
}

export function clientIdFromRequest(request: Request): string | null {
  const header = request.headers.get("X-Client-Id")?.trim();
  return header && header.length > 0 ? header : null;
}
