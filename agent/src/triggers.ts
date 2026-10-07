import { tryCatch } from "@lyzyos/utils";

type TriggerBody = {
  projectId?: string;
  userMessage?: string;
  name?: string;
  text?: string;
  workspaceId?: string;
  nodeId?: string;
};

/**
 * Agent-only HTTP surface used by the API worker to wake a project agent.
 * Realtime clients still use WebSockets via /agents/*.
 */
export async function handleAgentTrigger(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/agent/")) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const [body, error] = await tryCatch(request.json() as Promise<TriggerBody>);
  if (error) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId?.trim() ?? "";
  if (projectId.length === 0) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const agent = env.AGENT.getByName(projectId);

  switch (url.pathname.replace(/\/+$/, "")) {
    case "/agent/kickoff":
      ctx.waitUntil(
        agent.startKickoff({ projectId }).catch((err) => {
          console.error("kickoff failed", err);
        }),
      );
      return Response.json({ ok: true, accepted: true });

    case "/agent/invoke": {
      const workspaceId = body.workspaceId?.trim() ?? "";
      const nodeId = body.nodeId?.trim() ?? "";
      if (!workspaceId || !nodeId) {
        return Response.json({ error: "workspaceId and nodeId are required" }, { status: 400 });
      }
      ctx.waitUntil(
        agent.invokeFromNode({ projectId, workspaceId, nodeId }).catch((err) => {
          console.error("invoke failed", err);
        }),
      );
      return Response.json({ ok: true, accepted: true });
    }

    default:
      return Response.json({ error: "Not found" }, { status: 404 });
  }
}
