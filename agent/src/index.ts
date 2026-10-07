import { routeAgentRequest } from "agents";
import { tryCatch } from "@lyzyos/utils";
import { z } from "zod";
import { Lyzy } from "./agent";
import { chatBodySchema } from "./schema";

export { Lyzy };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const trigger = await handleAgentTrigger(request, env, ctx);
    if (trigger) return trigger;

    return (await routeAgentRequest(request, env)) || new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleAgentTrigger(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  if (url.pathname !== "/chat") return null;

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

  const [body, error] = await tryCatch(request.json());
  if (error) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = chatBodySchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: z.treeifyError(result.error) },
      { status: 400 },
    );
  }

  const agent = env.AGENT.getByName(result.data.projectId);

  ctx.waitUntil(
    agent.handleChat(result.data).catch((err: unknown) => {
      console.error("chat failed", err);
    }),
  );

  return Response.json({ ok: true, accepted: true });
}
