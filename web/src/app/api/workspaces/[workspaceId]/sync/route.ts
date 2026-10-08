import { getEnv } from "@/server/env";
import { getSession } from "@/server/session";
import { getWorkspaceForUser } from "@lyzyos/db";

export const runtime = "edge";

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: Params) {
  const upgrade = request.headers.get("Upgrade");
  if (upgrade?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { workspaceId } = await params;
  const env = await getEnv();

  const workspace = await getWorkspaceForUser(env.DB, workspaceId, session.user.id);
  if (!workspace) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  url.searchParams.set("workspaceId", workspace.id);
  if (!url.searchParams.get("clientId")) {
    const fromHeader = request.headers.get("X-Client-Id")?.trim();
    if (fromHeader) url.searchParams.set("clientId", fromHeader);
  }
  if (!url.searchParams.get("name") && session.user.name) {
    url.searchParams.set("name", session.user.name.slice(0, 40));
  }

  const stub = env.WORKSPACE_SYNC.getByName(workspace.id);
  return stub.fetch(new Request(url.toString(), request));
}
