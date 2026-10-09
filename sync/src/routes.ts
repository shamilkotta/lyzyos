import { getAuth } from "./auth";
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
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Unauthorized", { status: 401 });

  let userName: string;
  try {
    const auth = getAuth(env);
    const result = await auth.api.verifyOneTimeToken({ body: { token } });
    userName = result.user.name;
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.delete("token");
  if (!url.searchParams.get("clientId")) {
    const fromHeader = clientIdFromRequest(request);
    if (fromHeader) url.searchParams.set("clientId", fromHeader);
  }
  if (!url.searchParams.get("name")) {
    url.searchParams.set("name", userName.slice(0, 40));
  }

  const stub = env.WORKSPACE_SYNC.getByName(workspaceId);
  return stub.fetch(new Request(url.toString(), request));
}
