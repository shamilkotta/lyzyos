import "server-only";

import type { AppEnv } from "./env";

type AgentMessage = { id?: string; role: "user"; name: string; message: string };

/** Fire-and-forget chat turn for the project agent; kept alive past the response via waitUntil. */
export function notifyAgent(
  env: AppEnv,
  body: { projectId: string; threadId: string; workspaceId: string; message: AgentMessage[] },
  ctx?: { waitUntil: (p: Promise<unknown>) => void },
) {
  const agent = env.AGENT;
  if (!agent) return;

  const p = agent
    .fetch(
      new Request("https://agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": env.INTERNAL_SECRET,
        },
        body: JSON.stringify(body),
      }),
    )
    .then((res: Response) => {
      if (!res.ok) console.warn(`agent chat → ${res.status}`);
    })
    .catch((err: unknown) => {
      console.warn("agent chat failed", err);
    });

  ctx?.waitUntil(p);
}

/** Whether the agent is mid-turn for this project. Any failure reads as "not working". */
export async function getAgentWorking(env: AppEnv, projectId: string) {
  if (!env.AGENT) return false;
  const url = new URL("https://agent/status");
  url.searchParams.set("projectId", projectId);
  try {
    const res = await env.AGENT.fetch(
      new Request(url, { headers: { "X-Internal-Secret": env.INTERNAL_SECRET } }),
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { working?: boolean };
    return data.working === true;
  } catch {
    return false;
  }
}
