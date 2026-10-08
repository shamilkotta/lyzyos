import { getWorkspaceForUser } from "@lyzyos/db";
import { requireSessionUser } from "./auth";
import { corsHeaders, json } from "./cors";
import { clientIdFromRequest } from "./sync/publish";

export async function handleApi(request: Request, env: Env, _ctx: ExecutionContext) {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/health" && request.method === "GET") {
    return new Response("ok", {
      headers: { ...corsHeaders(origin), "Content-Type": "text/plain" },
    });
  }

  const syncMatch = path.match(/^\/api\/workspaces\/([^/]+)\/sync$/);
  if (syncMatch && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    return upgradeWorkspaceSync(request, env, syncMatch[1]);
  }

  return json({ error: "Not found" }, { status: 404 });
}

async function upgradeWorkspaceSync(request: Request, env: Env, workspaceId: string) {
  const user = await requireSessionUser(request, env);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const workspace = await getWorkspaceForUser(env.DB, workspaceId, user.id);
  if (!workspace) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  url.searchParams.set("workspaceId", workspace.id);
  if (!url.searchParams.get("clientId")) {
    const fromHeader = clientIdFromRequest(request);
    if (fromHeader) url.searchParams.set("clientId", fromHeader);
  }
  if (!url.searchParams.get("name") && user.name) {
    url.searchParams.set("name", user.name.slice(0, 40));
  }

  const stub = env.WORKSPACE_SYNC.getByName(workspace.id);
  return stub.fetch(new Request(url.toString(), request));
}
