import "server-only";

import type { AppEnv } from "./env";

export function notifyAgent(env: AppEnv, body: Record<string, unknown>) {
  const agent = env.AGENT;
  if (!agent) return;

  void agent
    .fetch(
      new Request("https://agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
    .then((res: Response) => {
      if (!res.ok) console.warn(`agent chat → ${res.status}`);
    })
    .catch((err: unknown) => {
      console.warn("agent chat failed", err);
    });
}
