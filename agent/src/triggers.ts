type TriggerBody = {
  projectId?: string;
  userMessage?: string;
  name?: string;
  text?: string;
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

  let body: TriggerBody;
  try {
    body = (await request.json()) as TriggerBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId?.trim() ?? "";
  if (projectId.length === 0) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const agent = env.AGENT.getByName(projectId);

  switch (url.pathname.replace(/\/+$/, "")) {
    case "/agent/kickoff":
      ctx.waitUntil(agent.startKickoff({ projectId }));
      return Response.json({ ok: true }, { status: 202 });

    case "/agent/refresh":
      ctx.waitUntil(agent.refreshBoard({ projectId }));
      return Response.json({ ok: true }, { status: 202 });

    case "/agent/continue": {
      const userMessage = body.userMessage?.trim() ?? "";
      if (userMessage.length === 0) {
        return Response.json({ error: "userMessage is required" }, { status: 400 });
      }
      ctx.waitUntil(agent.continuePlanning({ projectId, userMessage }));
      return Response.json({ ok: true }, { status: 202 });
    }

    case "/agent/ingest": {
      const name = body.name?.trim() ?? "";
      const text = body.text ?? "";
      if (name.length === 0) {
        return Response.json({ error: "name is required" }, { status: 400 });
      }
      ctx.waitUntil(
        (async () => {
          await agent.ingestDocument({ projectId, name, text });
          await agent.refreshBoard({ projectId });
        })(),
      );
      return Response.json({ ok: true }, { status: 202 });
    }

    default:
      return Response.json({ error: "Not found" }, { status: 404 });
  }
}
