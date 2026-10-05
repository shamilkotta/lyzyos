export { Lyzy } from "./lyzy";
export type { BoardState, PlanningNodeDto, ProjectDto } from "@lyzyos/db";

import { routeAgentRequest } from "agents";
import { handleAgentTrigger } from "./triggers";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", { headers: { "Content-Type": "text/plain" } });
    }

    const trigger = await handleAgentTrigger(request, env, ctx);
    if (trigger) return trigger;

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
